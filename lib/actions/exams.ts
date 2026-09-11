"use server";

import { db } from "@/lib/db";
import { examSessions, examSubjects, examGradeRules, examMarks } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createExamSchema = z.object({
  name: z.string().min(1, "Name required"),
  track: z.enum(["school", "madrasa", "hifz"]),
  academicYearId: z.string().uuid("Academic year required"),
  examinationId: z.string().uuid("Examination ID required"),
  startDate: z.string().transform(v => v === "" ? null : v).nullable().optional(),
  endDate: z.string().transform(v => v === "" ? null : v).nullable().optional(),
  tutorMarkEntryOnly: z.boolean().default(false),
});

const subjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Subject name required"),
  totalMarks: z.coerce.number().int().min(1).default(100),
  passMarks: z.coerce.number().int().min(1).default(35),
  displayOrder: z.coerce.number().int().default(0),
  examDate: z.string().optional().nullable(),
});

const saveSubjectsSchema = z.object({
  examSessionId: z.string().uuid(),
  classId: z.string().uuid(),
  subjects: z.array(subjectSchema),
  applyToAllClassIds: z.array(z.string().uuid()).optional(),
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

export async function deleteExamSession(id: string) {
  const session = await requireRole(["super_admin", "admin"]);

  // Prevent deleting a published exam
  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
  });
  if (!exam) return { success: false, error: "Exam not found" };
  if (exam.resultStatus === "published")
    return { success: false, error: "Cannot delete a published exam. Unpublish it first." };

  await db.delete(examSessions).where(eq(examSessions.id, id));
  await logActivity(session.user.id, "exam.delete", "exam_session", id);
  revalidatePath("/admin/exams");
  return { success: true };
}

export async function publishExamResults(examSessionId: string) {
  await requireRole(["super_admin"]);

  await db
    .update(examSessions)
    .set({ resultStatus: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(examSessions.id, examSessionId));

  // Notification integration
  try {
    const { notificationService } = await import("@/lib/services/notifications");
    const sessionData = await db.query.examSessions.findFirst({
      where: eq(examSessions.id, examSessionId),
      with: { examination: true }
    });
    
    if (sessionData) {
      const recipients = await notificationService.resolveExamResultsRecipients(examSessionId);
      await notificationService.createNotification({
        type: "exam_results_published",
        title: "Your exam results are ready",
        body: `Results for ${sessionData.examination.name} are now available.`,
        entityType: "exam_session",
        entityId: examSessionId,
        deepLink: `/parent/results/${sessionData.examinationId}`,
        recipients,
        idempotencyKey: `exam_results_published:${examSessionId}`,
      });
    }
  } catch (err) {
    console.error("Failed to send publish notification:", err);
  }

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

export async function updateSessionDates(sessionId: string, startDate: string | null, endDate: string | null) {
  const session = await requireRole(["super_admin", "admin"]);
  
  if (startDate && endDate && startDate > endDate) {
    return { success: false, error: "End date cannot be before start date" };
  }

  try {
    const [updated] = await db
      .update(examSessions)
      .set({ 
        startDate: startDate || null, 
        endDate: endDate || null, 
        updatedAt: new Date() 
      })
      .where(eq(examSessions.id, sessionId))
      .returning();

    if (!updated) return { success: false, error: "Session not found" };

    revalidatePath(`/admin/exams/${updated.examinationId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update session dates:", error);
    return { success: false, error: "Failed to update schedule" };
  }
}

// ─── Subject Actions ──────────────────────────────────────────────────────────

export async function saveExamSubjects(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = saveSubjectsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const { examSessionId, classId, subjects, applyToAllClassIds } = parsed.data;

  const targetClassIds = applyToAllClassIds?.length ? applyToAllClassIds : [classId];

  // Delete existing subjects for this session+class and re-insert
  await db
    .delete(examSubjects)
    .where(and(eq(examSubjects.examSessionId, examSessionId), inArray(examSubjects.classId, targetClassIds)));

  if (subjects.length > 0) {
    const insertData = targetClassIds.flatMap((targetId) => 
      subjects.map((s, i) => ({
        examSessionId,
        classId: targetId,
        name: s.name,
        totalMarks: s.totalMarks,
        passMarks: s.passMarks,
        displayOrder: s.displayOrder ?? i,
        examDate: s.examDate ?? null,
      }))
    );
    await db.insert(examSubjects).values(insertData);
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
