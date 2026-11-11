"use server";

import { db } from "@/lib/db";
import { examSessions, examSubjects, examGradeRules, examMarks, examTrackSubjects } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { syncClassSubjects, assertClassesInTrack, findLastExamSubjects } from "@/lib/exams/subjects-db";
import { saveHifzResults } from "@/lib/exams/hifz-results";
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
        body: `${sessionData.track === "hifz" ? "Hifz" : sessionData.track === "madrasa" ? "Madrasa" : "School"} results for ${sessionData.examination.name} are now available.`,
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

function revalidateExam(examinationId: string) {
  revalidatePath(`/admin/exams/${examinationId}`);
}

export async function saveExamSubjects(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = saveSubjectsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const { examSessionId, classId, subjects, applyToAllClassIds } = parsed.data;
  const targetClassIds = [...new Set(applyToAllClassIds?.length ? applyToAllClassIds : [classId])];

  const check = await assertClassesInTrack(examSessionId, targetClassIds);
  if (!check.ok) return { success: false, error: check.error };

  await db.transaction(async (tx) => {
    for (const targetId of targetClassIds) {
      await syncClassSubjects(tx, examSessionId, targetId, subjects);
    }
  });

  await logActivity(session.user.id, "exam.subjects_updated", "exam_session", examSessionId);
  revalidateExam(check.exam.examinationId);
  return { success: true };
}

export async function copySubjectsFromLastExam(examSessionId: string, classId: string) {
  await requireRole(["super_admin", "admin"]);

  const check = await assertClassesInTrack(examSessionId, [classId]);
  if (!check.ok) return { success: false, error: check.error };
  const current = check.exam;

  // Subjects of the most recent OTHER exam of the SAME track for this class.
  const prevSubjects = await findLastExamSubjects(current, classId);
  if (prevSubjects.length === 0) {
    return { success: false, error: `No previous ${current.track} exam has subjects for this class` };
  }

  await db.transaction(async (tx) => {
    await syncClassSubjects(
      tx,
      examSessionId,
      classId,
      prevSubjects.map((s, i) => ({
        name: s.name,
        totalMarks: s.totalMarks,
        passMarks: s.passMarks,
        displayOrder: i,
        examDate: null,
      }))
    );
  });

  revalidateExam(current.examinationId);
  return { success: true, count: prevSubjects.length };
}

// ─── Track Subject Catalogue Actions ──────────────────────────────────────────
// A reusable subject list per track. Requires migration 0009_exam_track_subjects.sql.

const MIGRATION_MSG =
  "Subject list is not set up yet. Run the 0009 migration (scripts/migrate-exam-track-subjects.ts).";

function isMissingTable(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

const trackSubjectSchema = z.object({
  track: z.enum(["school", "madrasa", "hifz"]),
  name: z.string().trim().min(1, "Subject name required").max(150),
  totalMarks: z.coerce.number().int().min(1).default(100),
  passMarks: z.coerce.number().int().min(0).default(35),
});

export async function addTrackSubject(input: unknown) {
  await requireRole(["super_admin", "admin"]);
  const parsed = trackSubjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { track, name, totalMarks, passMarks } = parsed.data;
  if (passMarks > totalMarks) return { success: false, error: "Pass marks cannot exceed total marks" };

  try {
    const existing = await db.select().from(examTrackSubjects).where(eq(examTrackSubjects.track, track));
    if (existing.some((e) => e.name.trim().toLowerCase() === name.toLowerCase())) {
      return { success: false, error: `"${name}" is already in the ${track} subject list` };
    }
    await db.insert(examTrackSubjects).values({ track, name, totalMarks, passMarks, displayOrder: existing.length });
  } catch (err) {
    if (isMissingTable(err)) return { success: false, error: MIGRATION_MSG };
    console.error("[addTrackSubject]", err);
    return { success: false, error: "Failed to add subject" };
  }
  revalidatePath("/admin/exams");
  return { success: true };
}

export async function removeTrackSubject(id: string) {
  await requireRole(["super_admin", "admin"]);
  try {
    // Only removes the catalogue entry; subjects already used in exams are untouched.
    await db.delete(examTrackSubjects).where(eq(examTrackSubjects.id, id));
  } catch (err) {
    if (isMissingTable(err)) return { success: false, error: MIGRATION_MSG };
    console.error("[removeTrackSubject]", err);
    return { success: false, error: "Failed to remove subject" };
  }
  revalidatePath("/admin/exams");
  return { success: true };
}

const applyCatalogueSchema = z.object({
  examSessionId: z.string().uuid(),
  classIds: z.array(z.string().uuid()).min(1),
  catalogueIds: z.array(z.string().uuid()).optional(), // default: whole track catalogue
});

/** Adds catalogue subjects to the given classes, skipping any a class already has. Never removes or edits. */
export async function applyCatalogueToClasses(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);
  const parsed = applyCatalogueSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request" };
  const { examSessionId, classIds, catalogueIds } = parsed.data;

  const uniqueClassIds = [...new Set(classIds)];
  const check = await assertClassesInTrack(examSessionId, uniqueClassIds);
  if (!check.ok) return { success: false, error: check.error };

  let catalogue;
  try {
    catalogue = await db
      .select()
      .from(examTrackSubjects)
      .where(
        catalogueIds?.length
          ? and(eq(examTrackSubjects.track, check.exam.track), inArray(examTrackSubjects.id, catalogueIds))
          : eq(examTrackSubjects.track, check.exam.track)
      );
  } catch (err) {
    if (isMissingTable(err)) return { success: false, error: MIGRATION_MSG };
    throw err;
  }
  catalogue.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  if (catalogue.length === 0) return { success: false, error: `No ${check.exam.track} subjects in the list yet` };

  let added = 0;
  await db.transaction(async (tx) => {
    for (const classId of uniqueClassIds) {
      const existing = await tx
        .select()
        .from(examSubjects)
        .where(and(eq(examSubjects.examSessionId, examSessionId), eq(examSubjects.classId, classId)));
      const have = new Set(existing.map((e) => e.name.trim().toLowerCase()));
      let order = existing.reduce((m, e) => Math.max(m, (e.displayOrder ?? 0) + 1), 0);
      const toAdd = catalogue.filter((c) => !have.has(c.name.trim().toLowerCase()));
      if (toAdd.length === 0) continue;
      await tx.insert(examSubjects).values(
        toAdd.map((c) => ({
          examSessionId,
          classId,
          name: c.name,
          totalMarks: c.totalMarks,
          passMarks: c.passMarks,
          displayOrder: order++,
        }))
      );
      added += toAdd.length;
    }
  });

  await logActivity(session.user.id, "exam.subjects_updated", "exam_session", examSessionId);
  revalidateExam(check.exam.examinationId);
  return { success: true, added };
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

// ─── Hifz Exam Juz Actions ────────────────────────────────────────────────────
// Exam-specific "Juz to be obtained" / "Juz memorized" per student. Requires migration 0010.

const juzField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || v === "" ? null : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), "Juz must be a number");

const saveHifzResultsSchema = z.object({
  examSessionId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        juzToObtain: juzField,
        juzMemorized: juzField,
        remarks: z.string().max(300).nullable().optional().transform((v) => v ?? null),
      })
    )
    .min(1)
    .max(500),
});

export async function saveHifzExamResults(input: unknown) {
  const session = await requireRole(["super_admin", "admin", "tutor"]);
  const parsed = saveHifzResultsSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const res = await saveHifzResults(parsed.data.examSessionId, parsed.data.rows, session.user.id);
  if (res.success) {
    await logActivity(session.user.id, "exam.hifz_juz_saved", "exam_session", parsed.data.examSessionId);
  }
  return res;
}
