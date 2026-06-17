"use server";

import { db } from "@/lib/db";
import {
  academicYears,
  batches,
  classes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { eq, and, ne, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// =============================================
// SCHEMA VALIDATORS
// =============================================
const createAcademicYearSchema = z.object({
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
  label:     z.string().optional(), // e.g. "2024-25"
});

const createBatchSchema = z.object({
  batchNumber: z.number().int().positive(),
  notes:       z.string().optional(),
});

// =============================================
// CREATE A NEW ACADEMIC YEAR (time period only)
// Clones all active classes from the previous current year.
// Does NOT create a batch — that is a separate step.
// =============================================
export async function createAcademicYear(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = createAcademicYearSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + JSON.stringify(parsed.error.flatten()) };
  }

  const { startDate, endDate, label: customLabel } = parsed.data;

  // Default dates
  const today = new Date();
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(today.getFullYear() + 1);
  const resolvedStart = startDate ? new Date(startDate) : today;
  const resolvedEnd   = endDate   ? new Date(endDate)   : oneYearLater;

  // Auto-generate label from dates or use provided
  const yearLabel = customLabel
    ?? `${resolvedStart.getFullYear()}-${String(resolvedEnd.getFullYear()).slice(-2)}`;

  // Get currently active year for class cloning
  const currentYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isCurrent, true),
  });

  // 1. Un-mark old current year
  if (currentYear) {
    await db
      .update(academicYears)
      .set({ isCurrent: false })
      .where(eq(academicYears.id, currentYear.id));
  }

  // 2. Create new academic year (mark as current)
  //    batchNumber on academicYears is now DEPRECATED — kept for compat only.
  const [newYear] = await db
    .insert(academicYears)
    .values({
      label: yearLabel,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      isCurrent: true,
    })
    .returning();

  // 3. Clone all active classes from previous year into new year
  if (currentYear) {
    const oldClasses = await db.query.classes.findMany({
      where: and(
        eq(classes.academicYearId, currentYear.id),
        eq(classes.isActive, true)
      ),
    });

    if (oldClasses.length > 0) {
      await db.insert(classes).values(
        oldClasses.map((cls) => ({
          name:           cls.name,
          track:          cls.track,
          tutorId:        cls.tutorId,
          academicYearId: newYear.id,
          capacity:       cls.capacity,
          isActive:       true,
          displayOrder:   cls.displayOrder,
        }))
      );
    }
  }

  await logActivity(session.user.id, "academic_year.create", "academic_years", newYear.id);
  revalidatePath("/admin/settings/academic-year");
  revalidatePath("/admin/settings");

  return { success: true, data: newYear };
}

// =============================================
// CREATE A NEW BATCH (student cohort)
// Separate from academic years.
// =============================================
export async function createBatch(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = createBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + JSON.stringify(parsed.error.flatten()) };
  }

  const { batchNumber, notes } = parsed.data;

  // Check for duplicate
  const existing = await db.query.batches.findFirst({
    where: eq(batches.batchNumber, batchNumber),
  });
  if (existing) {
    return { success: false, error: `Batch ${batchNumber} already exists.` };
  }

  const [newBatch] = await db
    .insert(batches)
    .values({
      batchNumber,
      label: `Batch ${batchNumber}`,
      notes: notes ?? null,
    })
    .returning();

  await logActivity(session.user.id, "batch.create", "batches", newBatch.id);
  revalidatePath("/admin/settings/academic-year");

  return { success: true, data: newBatch };
}

// =============================================
// GET ALL BATCHES with active student counts
// A batch is "current" if it has ≥1 active student.
// =============================================
export async function getAllBatchesWithCounts() {
  const allBatches = await db.query.batches.findMany({
    orderBy: (b, { asc }) => [asc(b.batchNumber)],
  });

  // Count active students per batch
  const activeCounts = await db
    .select({
      batchId: students.batchId,
      count:   sql<number>`COUNT(*)::int`,
    })
    .from(students)
    .where(eq(students.status, "active"))
    .groupBy(students.batchId);

  // Count all students per batch
  const totalCounts = await db
    .select({
      batchId: students.batchId,
      count:   sql<number>`COUNT(*)::int`,
    })
    .from(students)
    .groupBy(students.batchId);

  const activeMap = new Map(activeCounts.map((r) => [r.batchId, r.count]));
  const totalMap  = new Map(totalCounts.map((r) => [r.batchId, r.count]));

  return allBatches.map((b) => ({
    ...b,
    activeStudents: activeMap.get(b.id) ?? 0,
    totalStudents:  totalMap.get(b.id)  ?? 0,
    isCurrent:      (activeMap.get(b.id) ?? 0) > 0,
  }));
}

// =============================================
// GET NEXT BATCH NUMBER (max existing + 1)
// =============================================
export async function getNextBatchNumber(): Promise<number> {
  const result = await db
    .select({ maxBatch: sql<number>`COALESCE(MAX(${batches.batchNumber}), 0)` })
    .from(batches);
  return (result[0]?.maxBatch ?? 0) + 1;
}

// =============================================
// PROMOTE A SINGLE STUDENT to the new academic year
// =============================================
export async function promoteStudent(studentId: string, newAcademicYearId: string) {
  const session = await requireRole(["super_admin", "admin", "tutor"]);

  const activeEnrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, "active")
    ),
    with: { class: true },
  });

  if (!activeEnrollment) {
    return { success: false, error: "No active enrollment found for this student." };
  }

  const alreadyPromoted = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.academicYearId, newAcademicYearId),
      eq(enrollments.status, "active")
    ),
  });
  if (alreadyPromoted) {
    return { success: false, error: "Student is already promoted to this academic year." };
  }

  const newClass = await db.query.classes.findFirst({
    where: and(
      eq(classes.academicYearId, newAcademicYearId),
      eq(classes.name, activeEnrollment.class.name),
      eq(classes.isActive, true)
    ),
  });

  if (!newClass) {
    return {
      success: false,
      error: `No matching class "${activeEnrollment.class.name}" found in the new academic year. Please create it first.`,
    };
  }

  const yearMap: Record<string, string> = {
    "1st": "2nd",
    "2nd": "3rd",
    "3rd": "3rd",
  };
  const currentYos = activeEnrollment.yearOfStudy ?? "1st";
  const nextYos = yearMap[currentYos] ?? "2nd";

  await db
    .update(enrollments)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(enrollments.id, activeEnrollment.id));

  const [newEnrollment] = await db
    .insert(enrollments)
    .values({
      studentId,
      classId: newClass.id,
      academicYearId: newAcademicYearId,
      yearOfStudy: nextYos,
      status: "active",
    })
    .returning();

  await logActivity(session.user.id, "student.promote", "enrollments", newEnrollment.id);
  revalidatePath("/admin/settings/academic-year/promote");
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true, data: newEnrollment };
}

// =============================================
// BULK PROMOTE all eligible students in a class
// =============================================
export async function bulkPromoteByClass(classId: string, newAcademicYearId: string) {
  await requireRole(["super_admin", "admin"]);

  const classEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.classId, classId),
      eq(enrollments.status, "active")
    ),
  });

  const results = await Promise.all(
    classEnrollments.map((e) => promoteStudent(e.studentId, newAcademicYearId))
  );

  const succeeded = results.filter((r) => r.success).length;
  const failed    = results.filter((r) => !r.success).length;

  revalidatePath("/admin/settings/academic-year/promote");
  return { success: true, succeeded, failed };
}

// =============================================
// GET PROMOTION STATUS for all active students
// =============================================
export async function getPromotionStatus(newAcademicYearId: string) {
  const allActiveEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.status, "active"),
      ne(enrollments.academicYearId, newAcademicYearId)
    ),
    with: {
      student: true,
      class: true,
      academicYear: true,
    },
  });

  const promotedEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.academicYearId, newAcademicYearId),
      eq(enrollments.status, "active")
    ),
  });
  const promotedStudentIds = new Set(promotedEnrollments.map((e) => e.studentId));

  const pending  = allActiveEnrollments.filter((e) => !promotedStudentIds.has(e.studentId));
  const promoted = allActiveEnrollments.filter((e) =>  promotedStudentIds.has(e.studentId));

  return { pending, promoted };
}
