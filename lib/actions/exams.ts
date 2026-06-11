"use server";

import { db } from "@/lib/db";
import { examSessions, examSubjects, examGradeRules, examMarks } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createExamSchema = z.object({
  name: z.string().min(1, "Name required"),
  track: z.enum(["school", "madrasa", "hifz"]),
  academicYearId: z.string().uuid("Academic year required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const subjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Subject name required"),
  totalMarks: z.coerce.number().int().min(1).default(100),
  passMarks: z.coerce.number().int().min(1).default(35),
  displayOrder: z.coerce.number().int().default(0),
});

const saveSubjectsSchema = z.object({
  examSessionId: z.string().uuid(),
  classId: z.string().uuid(),
  subjects: z.array(subjectSchema),
});

const gradeRuleSchema = z.object({
  grade: z.string().min(1),
  minPercentage: z.coerce.number().min(0).max(100),
  label: z.string().optional(),
  isFailing: z.boolean().default(false),
  displayOrder: z.coerce.number().int().default(0),
});

const saveGradeRulesSchema = z.object({
  examSessionId: z.string().uuid(),
  rules: z.array(gradeRuleSchema),
});

const markSchema = z.object({
  examSubjectId: z.string().uuid(),
  studentId: z.string().uuid(),
  // Accept string numbers from form inputs, coerce to number, allow null
  marksObtained: z
    .union([z.string(), z.number(), z.null()])
    .transform((val) => {
      if (val === null || val === "" || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    })
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  isAbsent: z.boolean().default(false),
  remarks: z.string().optional().nullable(),
});

// ─── Exam Session Actions ─────────────────────────────────────────────────────

export async function createExamSession(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = createExamSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const [exam] = await db
    .insert(examSessions)
    .values({
      ...parsed.data,
      createdBy: session.user.id,
    })
    .returning();

  await logActivity(session.user.id, "exam.create", "exam_session", exam.id);
  revalidatePath("/admin/exams");
  return { success: true, data: exam };
}

export async function updateExamSession(id: string, input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = createExamSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const [exam] = await db
    .update(examSessions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(examSessions.id, id))
    .returning();

  revalidatePath("/admin/exams");
  revalidatePath(`/admin/exams/${id}`);
  return { success: true, data: exam };
}

export async function publishExamResults(examSessionId: string) {
  await requireRole(["super_admin"]);

  await db
    .update(examSessions)
    .set({ resultStatus: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(examSessions.id, examSessionId));

  revalidatePath(`/admin/exams/${examSessionId}`);
  revalidatePath("/admin/exams");
  return { success: true };
}

export async function unpublishExamResults(examSessionId: string) {
  await requireRole(["super_admin"]);

  await db
    .update(examSessions)
    .set({ resultStatus: "draft", publishedAt: null, updatedAt: new Date() })
    .where(eq(examSessions.id, examSessionId));

  revalidatePath(`/admin/exams/${examSessionId}`);
  return { success: true };
}

// ─── Subject Actions ──────────────────────────────────────────────────────────

export async function saveExamSubjects(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = saveSubjectsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const { examSessionId, classId, subjects } = parsed.data;

  // Delete existing subjects for this session+class and re-insert
  await db
    .delete(examSubjects)
    .where(and(eq(examSubjects.examSessionId, examSessionId), eq(examSubjects.classId, classId)));

  if (subjects.length > 0) {
    await db.insert(examSubjects).values(
      subjects.map((s, i) => ({
        examSessionId,
        classId,
        name: s.name,
        totalMarks: s.totalMarks,
        passMarks: s.passMarks,
        displayOrder: s.displayOrder ?? i,
      }))
    );
  }

  await logActivity(session.user.id, "exam.subjects_updated", "exam_session", examSessionId);
  revalidatePath(`/admin/exams/${examSessionId}`);
  return { success: true };
}

export async function copySubjectsFromLastExam(examSessionId: string, classId: string) {
  await requireRole(["super_admin", "admin"]);

  // Find the current session's track & academic year
  const current = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, examSessionId),
  });
  if (!current) return { success: false, error: "Exam session not found" };

  // Find the previous session with the same track (excluding current)
  const previous = await db.query.examSessions.findFirst({
    where: and(
      eq(examSessions.track, current.track),
    ),
    with: { subjects: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const prevSubjects = previous?.subjects.filter(s => s.classId === classId) ?? [];
  if (prevSubjects.length === 0) return { success: false, error: "No previous subjects found for this class" };

  // Copy them into the current session
  await db.delete(examSubjects).where(
    and(eq(examSubjects.examSessionId, examSessionId), eq(examSubjects.classId, classId))
  );
  await db.insert(examSubjects).values(
    prevSubjects.map(s => ({
      examSessionId,
      classId,
      name: s.name,
      totalMarks: s.totalMarks,
      passMarks: s.passMarks,
      displayOrder: s.displayOrder,
    }))
  );

  revalidatePath(`/admin/exams/${examSessionId}`);
  return { success: true, count: prevSubjects.length };
}

// ─── Grade Rule Actions ───────────────────────────────────────────────────────

export async function saveGradeRules(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = saveGradeRulesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const { examSessionId, rules } = parsed.data;

  await db.delete(examGradeRules).where(eq(examGradeRules.examSessionId, examSessionId));

  if (rules.length > 0) {
    await db.insert(examGradeRules).values(
      rules.map((r, i) => ({
        examSessionId,
        grade: r.grade,
        minPercentage: String(r.minPercentage),
        label: r.label ?? null,
        isFailing: r.isFailing,
        displayOrder: r.displayOrder ?? i,
      }))
    );
  }

  revalidatePath(`/admin/exams/${examSessionId}`);
  return { success: true };
}

// ─── Mark Entry Actions ───────────────────────────────────────────────────────

export async function saveExamMark(input: unknown) {
  const session = await requireRole(["super_admin", "admin", "tutor", "school_admin"]);
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const { examSubjectId, studentId, marksObtained, isAbsent, remarks } = parsed.data;

  await db
    .insert(examMarks)
    .values({
      examSubjectId,
      studentId,
      marksObtained: marksObtained !== null ? String(marksObtained) : null,
      isAbsent,
      remarks: remarks ?? null,
      enteredBy: session.user.id,
    })
    .onConflictDoUpdate({
      target: [examMarks.examSubjectId, examMarks.studentId],
      set: {
        marksObtained: marksObtained !== null ? String(marksObtained) : null,
        isAbsent,
        remarks: remarks ?? null,
        enteredBy: session.user.id,
        updatedAt: new Date(),
      },
    });

  return { success: true };
}

const bulkMarkSchema = z.object({
  marks: z.array(markSchema),
});

export async function saveBulkExamMarks(input: unknown) {
  try {
    const session = await requireRole(["super_admin", "admin", "tutor", "school_admin"]);
    const parsed = bulkMarkSchema.safeParse(input);

    if (!parsed.success) {
      console.error("[saveBulkExamMarks] Validation error:", JSON.stringify(parsed.error.flatten()));
      return { success: false, error: "Validation failed: " + JSON.stringify(parsed.error.flatten().fieldErrors) };
    }

    if (parsed.data.marks.length === 0) return { success: true };

    const rows = parsed.data.marks.map((m) => ({
      examSubjectId: m.examSubjectId,
      studentId: m.studentId,
      marksObtained: m.marksObtained !== null ? String(m.marksObtained) : null,
      isAbsent: m.isAbsent,
      remarks: m.remarks ?? null,
      enteredBy: session.user.id,
    }));

    await db
      .insert(examMarks)
      .values(rows)
      .onConflictDoUpdate({
        target: [examMarks.examSubjectId, examMarks.studentId],
        set: {
          marksObtained: sql`EXCLUDED.marks_obtained`,
          isAbsent: sql`EXCLUDED.is_absent`,
          remarks: sql`EXCLUDED.remarks`,
          enteredBy: sql`EXCLUDED.entered_by`,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (err) {
    console.error("[saveBulkExamMarks] Unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unexpected server error" };
  }
}
