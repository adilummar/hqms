// Server-side logic for Bulk Exam Mark Entry (plain module — NOT a "use server" file, so it
// can only be reached through the authorising wrappers in lib/actions/bulk-marks.ts).
//
// Relationship: examinations → exam_sessions (one per track) → exam_subjects (per class)
//               → exam_marks (unique per subject + student).
// A bulk sheet is ONE exam_subjects row. Eligible students = active enrolments in that
// subject's class (same rule as the individual mark-entry screen).
import { db } from "@/lib/db";
import { examSessions, examSubjects, examMarks, examinations, enrollments, classes, students } from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { validateMarkText } from "@/lib/exams/bulk-marks-validate";

export type BulkUser = { id: string; role: string };

const ENTRY_ROLES = ["super_admin", "admin", "tutor"];

export type SubjectContext = {
  subject: typeof examSubjects.$inferSelect;
  session: typeof examSessions.$inferSelect;
  cls: typeof classes.$inferSelect;
};

export type Denied = { ok: false; error: string };

/**
 * Loads the subject together with its session and class and proves they belong together:
 * subject ∈ session, class track = session track, and the caller may enter marks for it.
 * `forWrite` additionally enforces the publish lock.
 */
export async function resolveSubjectContext(
  user: BulkUser,
  examSessionId: string,
  examSubjectId: string,
  forWrite: boolean
): Promise<({ ok: true } & SubjectContext) | Denied> {
  if (!ENTRY_ROLES.includes(user.role)) return { ok: false, error: "You are not allowed to enter marks" };

  const subject = await db.query.examSubjects.findFirst({ where: eq(examSubjects.id, examSubjectId) });
  if (!subject || subject.examSessionId !== examSessionId) return { ok: false, error: "Subject does not belong to this exam session" };

  const [session, cls] = await Promise.all([
    db.query.examSessions.findFirst({ where: eq(examSessions.id, examSessionId) }),
    db.query.classes.findFirst({ where: eq(classes.id, subject.classId) }),
  ]);
  if (!session || !cls) return { ok: false, error: "Exam session or class not found" };
  if (cls.track !== session.track) return { ok: false, error: "Class does not belong to this track" };

  // Same rules as the individual screens
  if (session.tutorMarkEntryOnly && user.role !== "tutor")
    return { ok: false, error: "This exam only allows the assigned class tutor to enter marks" };
  if (user.role === "tutor") {
    if (cls.tutorId !== user.id) return { ok: false, error: "You can only enter marks for your own class" };
    // Existing tutor screen redirects away from Hifz sessions that are not published
    if (session.track === "hifz" && session.resultStatus !== "published")
      return { ok: false, error: "Hifz marks are not available to tutors for this exam" };
  }
  if (forWrite && session.resultStatus === "published")
    return { ok: false, error: "Results are published. Mark entry is locked." };

  return { ok: true, subject, session, cls };
}

export interface BulkSheet {
  subject: { id: string; name: string; totalMarks: number; passMarks: number };
  locked: boolean;
  students: {
    id: string;
    admissionNumber: string;
    name: string;
    mark: { value: string | null; absent: boolean } | null;
  }[];
}

/** Two queries total (students, marks) regardless of class size. */
export async function loadBulkSheet(user: BulkUser, examSessionId: string, examSubjectId: string) {
  const ctx = await resolveSubjectContext(user, examSessionId, examSubjectId, false);
  if (!ctx.ok) return ctx;

  const [roster, marks] = await Promise.all([
    db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        studentCode: students.studentCode,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(and(eq(enrollments.classId, ctx.subject.classId), eq(enrollments.status, "active")))
      .orderBy(asc(students.firstName), asc(students.lastName)),
    db
      .select({ studentId: examMarks.studentId, marksObtained: examMarks.marksObtained, isAbsent: examMarks.isAbsent })
      .from(examMarks)
      .where(eq(examMarks.examSubjectId, examSubjectId)),
  ]);
  const byStudent = new Map(marks.map((m) => [m.studentId, m]));

  const sheet: BulkSheet = {
    subject: { id: ctx.subject.id, name: ctx.subject.name, totalMarks: ctx.subject.totalMarks, passMarks: ctx.subject.passMarks },
    locked: ctx.session.resultStatus === "published",
    students: roster.map((s) => {
      const m = byStudent.get(s.id);
      return {
        id: s.id,
        admissionNumber: s.admissionNumber ?? s.studentCode,
        name: `${s.firstName} ${s.lastName ?? ""}`.trim(),
        mark: m ? { value: m.marksObtained, absent: m.isAbsent } : null,
      };
    }),
  };
  return { ok: true as const, sheet };
}

export interface BulkChange {
  studentId: string;
  /** Mark text as typed (validated, never rounded); ignored when absent */
  value: string;
  absent: boolean;
}

export type BulkSaveResult =
  | { ok: true; created: number; updated: number; unchanged: number }
  | { ok: false; error: string };

/**
 * All-or-nothing save of the changed rows for one subject. Existing marks that are not in
 * `changes` are never touched; remarks on updated rows are preserved; nothing is deleted.
 */
export async function applyBulkMarks(
  user: BulkUser,
  examSessionId: string,
  examSubjectId: string,
  changes: BulkChange[]
): Promise<BulkSaveResult> {
  if (changes.length === 0) return { ok: false, error: "No changes to save" };
  if (changes.length > 1000) return { ok: false, error: "Too many rows in one save" };

  const ctx = await resolveSubjectContext(user, examSessionId, examSubjectId, true);
  if (!ctx.ok) return ctx;

  // One row per student (a repeated student would otherwise hit the same row twice)
  const seen = new Set<string>();
  for (const c of changes) {
    if (seen.has(c.studentId)) return { ok: false, error: "Duplicate student in submission" };
    seen.add(c.studentId);
    if (!c.absent) {
      if (c.value.trim() === "") return { ok: false, error: "Empty marks cannot be saved" };
      const err = validateMarkText(c.value, ctx.subject.totalMarks);
      if (err) return { ok: false, error: `Invalid mark: ${err}` };
    }
  }

  const ids = changes.map((c) => c.studentId);
  const eligible = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classId, ctx.subject.classId), eq(enrollments.status, "active"), inArray(enrollments.studentId, ids)));
  const eligibleSet = new Set(eligible.map((e) => e.id));
  if (ids.some((id) => !eligibleSet.has(id))) return { ok: false, error: "A student is not eligible for this subject" };

  try {
    return await db.transaction(async (tx) => {
      // Re-check the lock inside the transaction (publish may have happened since page load)
      const [live] = await tx.select({ s: examSessions.resultStatus }).from(examSessions).where(eq(examSessions.id, examSessionId));
      if (!live || live.s === "published") return { ok: false as const, error: "Results are published. Mark entry is locked." };

      const existing = await tx
        .select()
        .from(examMarks)
        .where(and(eq(examMarks.examSubjectId, examSubjectId), inArray(examMarks.studentId, ids)));
      const prev = new Map(existing.map((m) => [m.studentId, m]));

      let unchanged = 0;
      const rows = [];
      let created = 0;
      let updated = 0;
      for (const c of changes) {
        const p = prev.get(c.studentId);
        const marks = c.absent ? null : c.value.trim();
        // Skip rows identical to what is stored (no timestamp churn, nothing "modified")
        if (p && p.isAbsent === c.absent && (c.absent || Number(p.marksObtained) === Number(marks))) {
          unchanged++;
          continue;
        }
        p ? updated++ : created++;
        rows.push({ examSubjectId, studentId: c.studentId, marksObtained: marks, isAbsent: c.absent, enteredBy: user.id });
      }

      if (rows.length > 0) {
        // The unique (subject, student) constraint makes this safe against double-clicks and
        // concurrent saves. `remarks` is deliberately not in the update set.
        await tx
          .insert(examMarks)
          .values(rows)
          .onConflictDoUpdate({
            target: [examMarks.examSubjectId, examMarks.studentId],
            set: {
              marksObtained: sql`excluded.marks_obtained`,
              isAbsent: sql`excluded.is_absent`,
              enteredBy: sql`excluded.entered_by`,
              updatedAt: new Date(),
            },
          });
      }
      return { ok: true as const, created, updated, unchanged };
    });
  } catch (err) {
    console.error("[applyBulkMarks]", err);
    return { ok: false, error: "Could not save marks. Nothing was changed." };
  }
}

export interface BulkOptions {
  examinations: {
    id: string;
    name: string;
    sessions: {
      id: string;
      track: "school" | "madrasa" | "hifz";
      name: string;
      locked: boolean;
      subjects: { id: string; name: string; totalMarks: number; className: string }[];
    }[];
  }[];
}

/**
 * Selector data only (no students, no marks). Admins see everything; tutors only the
 * subjects of classes they teach, and never unpublished Hifz sessions (existing rule).
 */
export async function loadBulkOptions(user: BulkUser): Promise<BulkOptions> {
  if (!ENTRY_ROLES.includes(user.role)) return { examinations: [] };

  const rows = await db
    .select({
      examId: examinations.id,
      examName: examinations.name,
      sessionId: examSessions.id,
      sessionName: examSessions.name,
      track: examSessions.track,
      resultStatus: examSessions.resultStatus,
      tutorOnly: examSessions.tutorMarkEntryOnly,
      subjectId: examSubjects.id,
      subjectName: examSubjects.name,
      totalMarks: examSubjects.totalMarks,
      displayOrder: examSubjects.displayOrder,
      className: classes.name,
      classTrack: classes.track,
      tutorId: classes.tutorId,
    })
    .from(examSubjects)
    .innerJoin(examSessions, eq(examSessions.id, examSubjects.examSessionId))
    .innerJoin(examinations, eq(examinations.id, examSessions.examinationId))
    .innerJoin(classes, eq(classes.id, examSubjects.classId))
    .orderBy(desc(examinations.createdAt), asc(examSessions.track), asc(classes.name), asc(examSubjects.displayOrder));

  const out = new Map<string, BulkOptions["examinations"][number]>();
  for (const r of rows) {
    if (r.classTrack !== r.track) continue;
    if (r.tutorOnly && user.role !== "tutor") continue;
    if (user.role === "tutor" && (r.tutorId !== user.id || (r.track === "hifz" && r.resultStatus !== "published"))) continue;
    let ex = out.get(r.examId);
    if (!ex) out.set(r.examId, (ex = { id: r.examId, name: r.examName, sessions: [] }));
    let s = ex.sessions.find((x) => x.id === r.sessionId);
    if (!s) ex.sessions.push((s = { id: r.sessionId, track: r.track, name: r.sessionName, locked: r.resultStatus === "published", subjects: [] }));
    s.subjects.push({ id: r.subjectId, name: r.subjectName, totalMarks: r.totalMarks, className: r.className });
  }
  return { examinations: [...out.values()] };
}
