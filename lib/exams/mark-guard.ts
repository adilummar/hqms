// Server-side authorisation + relationship checks for the individual (grid) mark-entry
// actions. Mirrors resolveSubjectContext() in bulk-marks.ts so both entry paths enforce the
// same rules: subject ∈ session, class track = session track, role/track permission, tutor
// owns the class, publish lock, and the student is actively enrolled in the subject's class.
// Plain module (NOT "use server"): reachable only through the authorising actions.
import { enrollmentStudentIsActive } from "@/lib/students/active";
import { db } from "@/lib/db";
import { examSessions, examSubjects, classes, enrollments } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type MarkUser = { id: string; role: string };
type Track = "school" | "madrasa" | "hifz";

export const MARK_WRITE_ROLES = ["super_admin", "admin", "tutor", "school_admin"];

export interface MarkWriteTarget {
  session: { track: Track; resultStatus: string; tutorMarkEntryOnly: boolean };
  cls: { track: Track; tutorId: string | null };
}

/** Pure rule check; returns an error message or null when the write is allowed. */
export function checkMarkWriteAccess(user: MarkUser, t: MarkWriteTarget): string | null {
  if (!MARK_WRITE_ROLES.includes(user.role)) return "You are not allowed to enter marks";
  if (t.cls.track !== t.session.track) return "Class does not belong to this track";
  if (user.role === "school_admin" && t.session.track !== "school") return "School admins can only enter School marks";
  if (t.session.tutorMarkEntryOnly && user.role !== "tutor")
    return "This exam only allows the assigned class tutor to enter marks";
  if (user.role === "tutor") {
    if (t.cls.tutorId !== user.id) return "You can only enter marks for your own class";
    if (t.session.track === "hifz" && t.session.resultStatus !== "published")
      return "Hifz marks are not available to tutors for this exam";
  }
  if (t.session.resultStatus === "published") return "Results are published. Mark entry is locked.";
  return null;
}

export interface MarkWrite {
  examSubjectId: string;
  studentId: string;
  marksObtained: number | null;
}

/** Validates every (subject, student) pair against the DB. Returns an error string or null. */
export async function authorizeMarkWrites(user: MarkUser, marks: MarkWrite[]): Promise<string | null> {
  if (!MARK_WRITE_ROLES.includes(user.role)) return "You are not allowed to enter marks";
  const subjectIds = [...new Set(marks.map((m) => m.examSubjectId))];
  if (subjectIds.length === 0) return null;

  const subjects = await db.select().from(examSubjects).where(inArray(examSubjects.id, subjectIds));
  if (subjects.length !== subjectIds.length) return "Unknown exam subject";
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const sessionIds = [...new Set(subjects.map((s) => s.examSessionId))];
  const classIds = [...new Set(subjects.map((s) => s.classId))];
  const [sessions, cls] = await Promise.all([
    db.select().from(examSessions).where(inArray(examSessions.id, sessionIds)),
    db.select().from(classes).where(inArray(classes.id, classIds)),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const classById = new Map(cls.map((c) => [c.id, c]));

  for (const s of subjects) {
    const session = sessionById.get(s.examSessionId);
    const c = classById.get(s.classId);
    if (!session || !c) return "Exam session or class not found";
    const err = checkMarkWriteAccess(user, { session, cls: c });
    if (err) return err;
  }

  for (const m of marks) {
    const s = subjectById.get(m.examSubjectId)!;
    if (m.marksObtained !== null && (m.marksObtained < 0 || m.marksObtained > s.totalMarks))
      return `Marks for ${s.name} must be between 0 and ${s.totalMarks}`;
  }

  // Student must be an active enrolment of the subject's class (per-class check)
  const byClass = new Map<string, Set<string>>();
  for (const m of marks) {
    const classId = subjectById.get(m.examSubjectId)!.classId;
    (byClass.get(classId) ?? byClass.set(classId, new Set()).get(classId)!).add(m.studentId);
  }
  for (const [classId, studentSet] of byClass) {
    const ids = [...studentSet];
    const rows = await db
      .select({ id: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.classId, classId), eq(enrollments.status, "active"), enrollmentStudentIsActive(), inArray(enrollments.studentId, ids)));
    if (rows.length !== ids.length) return "A student is not eligible for this subject";
  }
  return null;
}
