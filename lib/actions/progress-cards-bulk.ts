"use server";

// Bulk / PDF progress cards. Admin only (requireAdmin on every action, ids re-verified
// server-side). Cards come from the SAME service as the on-screen card
// (buildProgressCardsBatch); PDFs are rendered on the server in small batches so a large class
// never runs as one long request, and every student gets an explicit success/failure result.
import { z } from "zod";
import { db } from "@/lib/db";
import { classes, enrollments, examinations, examMarks, examSubjects, examSessions, examHifzResults, students } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { buildProgressCardsBatch, type ProgressCardOverrides } from "@/lib/exams/progress-card";
import { renderProgressCardPdf } from "@/lib/exams/progress-card-pdf";
import { cardFileStem } from "@/lib/exams/progress-card-view";

const MAX_BATCH = 8;

export interface BulkRosterRow {
  id: string;
  admissionNumber: string;
  name: string;
  className: string;
  /** Ready = the student has marks (or Hifz results) in this exam for this class's track */
  ready: boolean;
}

export interface RenderedCard {
  studentId: string;
  ok: boolean;
  fileStem?: string;
  /** base64 PDF */
  pdf?: string;
  error?: string;
}

/** Proves the class takes part in this examination (has subjects in the exam session of its own track). */
async function verifyClassInExam(examinationId: string, classId: string) {
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
  if (!cls) return { ok: false as const, error: "Class not found" };
  const [row] = await db
    .select({ sessionId: examSessions.id })
    .from(examSessions)
    .innerJoin(examSubjects, eq(examSubjects.examSessionId, examSessions.id))
    .where(and(eq(examSessions.examinationId, examinationId), eq(examSessions.track, cls.track), eq(examSubjects.classId, classId)))
    .limit(1);
  if (!row) return { ok: false as const, error: "This class has no subjects in the selected examination" };
  return { ok: true as const, cls, sessionId: row.sessionId };
}

async function activeClassStudentIds(classId: string): Promise<string[]> {
  const rows = await db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.classId, classId), eq(enrollments.status, "active"), eq(students.status, "active")));
  return [...new Set(rows.map((r) => r.id))];
}

const rosterSchema = z.object({ examinationId: z.string().uuid(), classId: z.string().uuid() });

export async function getBulkProgressCardRoster(input: unknown) {
  await requireAdmin();
  const p = rosterSchema.safeParse(input);
  if (!p.success) return { success: false as const, error: "Invalid selection" };
  const { examinationId, classId } = p.data;

  const v = await verifyClassInExam(examinationId, classId);
  if (!v.ok) return { success: false as const, error: v.error };

  const ids = await activeClassStudentIds(classId);
  if (ids.length === 0) return { success: true as const, rows: [] as BulkRosterRow[], className: v.cls.name };

  const [studentRows, subjects] = await Promise.all([
    db.select().from(students).where(inArray(students.id, ids)),
    db.select({ id: examSubjects.id }).from(examSubjects).where(and(eq(examSubjects.examSessionId, v.sessionId), eq(examSubjects.classId, classId))),
  ]);
  const subjectIds = subjects.map((s) => s.id);
  const [marked, hifz] = await Promise.all([
    subjectIds.length
      ? db.selectDistinct({ studentId: examMarks.studentId }).from(examMarks).where(and(inArray(examMarks.examSubjectId, subjectIds), inArray(examMarks.studentId, ids)))
      : Promise.resolve([] as { studentId: string }[]),
    v.cls.track === "hifz"
      ? db.select({ studentId: examHifzResults.studentId }).from(examHifzResults).where(and(eq(examHifzResults.examSessionId, v.sessionId), inArray(examHifzResults.studentId, ids))).catch(() => [])
      : Promise.resolve([] as { studentId: string }[]),
  ]);
  const ready = new Set([...marked.map((m) => m.studentId), ...hifz.map((h) => h.studentId)]);

  const rows: BulkRosterRow[] = studentRows
    .map((s) => ({
      id: s.id,
      admissionNumber: s.admissionNumber ?? s.studentCode,
      name: `${s.firstName} ${s.lastName ?? ""}`.trim(),
      className: v.cls.name,
      ready: ready.has(s.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { success: true as const, rows, className: v.cls.name };
}

async function renderCards(
  examinationId: string,
  studentIds: string[],
  overrides: ProgressCardOverrides
): Promise<RenderedCard[]> {
  const cards = await buildProgressCardsBatch(examinationId, studentIds, overrides);
  const out: RenderedCard[] = [];
  for (const id of studentIds) {
    const res = cards.get(id);
    if (!res || !res.success) {
      out.push({ studentId: id, ok: false, error: res && !res.success ? res.error : "Card could not be built" });
      continue;
    }
    try {
      const pdf = await renderProgressCardPdf([res.data]);
      out.push({ studentId: id, ok: true, fileStem: cardFileStem(res.data.admissionNumber, res.data.studentName), pdf: pdf.toString("base64") });
    } catch (err) {
      console.error("[progress-card pdf]", id, err);
      out.push({ studentId: id, ok: false, error: "PDF could not be generated" });
    }
  }
  return out;
}

const renderSchema = z.object({
  examinationId: z.string().uuid(),
  classId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH),
});

/** One small batch of a class's cards. The client calls this repeatedly and shows progress. */
export async function renderClassProgressCards(input: unknown) {
  await requireAdmin();
  const p = renderSchema.safeParse(input);
  if (!p.success) return { success: false as const, error: `Invalid request (max ${MAX_BATCH} students per batch)` };
  const { examinationId, classId, studentIds } = p.data;

  const v = await verifyClassInExam(examinationId, classId);
  if (!v.ok) return { success: false as const, error: v.error };

  // Class ownership: only active students of THIS class can be rendered through this action
  const allowed = new Set(await activeClassStudentIds(classId));
  const wanted = [...new Set(studentIds)];
  const results: RenderedCard[] = [];
  const ok = wanted.filter((id) => allowed.has(id));
  for (const id of wanted) if (!allowed.has(id)) results.push({ studentId: id, ok: false, error: "Student is not in this class" });
  results.push(...(await renderCards(examinationId, ok, {})));
  return { success: true as const, results };
}

const singleSchema = z.object({
  examinationId: z.string().uuid(),
  studentId: z.string().uuid(),
  overrides: z
    .object({
      toBeObtained: z.string().max(20).optional(),
      memorizedJuz: z.string().max(20).optional(),
      mentor: z.string().max(100).optional(),
      madrasaTeacher: z.string().max(100).optional(),
      schoolTeacher: z.string().max(100).optional(),
    })
    .optional(),
});

/** PDF of one card, with the same typed values the on-screen card was generated with. */
export async function renderSingleProgressCard(input: unknown) {
  await requireAdmin();
  const p = singleSchema.safeParse(input);
  if (!p.success) return { success: false as const, error: "Invalid request" };
  const exam = await db.query.examinations.findFirst({ where: eq(examinations.id, p.data.examinationId), columns: { id: true } });
  if (!exam) return { success: false as const, error: "Examination not found" };
  const [r] = await renderCards(p.data.examinationId, [p.data.studentId], p.data.overrides ?? {});
  return r.ok ? { success: true as const, card: r } : { success: false as const, error: r.error ?? "Failed" };
}
