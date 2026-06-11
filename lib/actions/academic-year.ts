"use server";

import { db } from "@/lib/db";
import {
  academicYears,
  classes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { eq, and, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createYearSchema = z.object({
  label: z.string().min(4).max(20), // "2025-26"
  startDate: z.string(), // ISO date string
  endDate: z.string(),
});

// =============================================
// CREATE A NEW ACADEMIC YEAR
// Clones all active classes from the previous current year
// =============================================
export async function createAcademicYear(input: unknown) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = createYearSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + JSON.stringify(parsed.error.flatten()) };
  }

  const { label, startDate, endDate } = parsed.data;

  // Check for duplicate label
  const existing = await db.query.academicYears.findFirst({
    where: eq(academicYears.label, label),
  });
  if (existing) {
    return { success: false, error: `Academic year "${label}" already exists.` };
  }

  // Get currently active year so we can clone its classes
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
  const [newYear] = await db
    .insert(academicYears)
    .values({
      label,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
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
          name: cls.name,
          track: cls.track,
          tutorId: cls.tutorId,
          academicYearId: newYear.id,
          capacity: cls.capacity,
          isActive: true,
          displayOrder: cls.displayOrder,
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
// PROMOTE A SINGLE STUDENT to the new academic year
// Closes old enrollment, opens new one with incremented yearOfStudy
// =============================================
export async function promoteStudent(studentId: string, newAcademicYearId: string) {
  const session = await requireRole(["super_admin", "admin", "tutor"]);

  // Get student's current active enrollment
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

  // Check not already promoted to the new year
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

  // Find the equivalent class in the new academic year (same name and track)
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

  // Compute next year of study: "1st" → "2nd" → "3rd"
  const yearMap: Record<string, string> = {
    "1st": "2nd",
    "2nd": "3rd",
    "3rd": "3rd", // cap at 3rd
  };
  const currentYos = activeEnrollment.yearOfStudy ?? "1st";
  const nextYos = yearMap[currentYos] ?? "2nd";

  // Close old enrollment
  await db
    .update(enrollments)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(enrollments.id, activeEnrollment.id));

  // Create new enrollment in new year
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
  const failed = results.filter((r) => !r.success).length;

  revalidatePath("/admin/settings/academic-year/promote");
  return { success: true, succeeded, failed };
}

// =============================================
// GET PROMOTION STATUS for all active students
// Returns: promoted & unpromoted lists for the given new year
// =============================================
export async function getPromotionStatus(newAcademicYearId: string) {
  // Get all currently active students with their old-year enrollment
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

  // Get students already promoted to the new year
  const promotedEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.academicYearId, newAcademicYearId),
      eq(enrollments.status, "active")
    ),
  });
  const promotedStudentIds = new Set(promotedEnrollments.map((e) => e.studentId));

  const pending = allActiveEnrollments.filter(
    (e) => !promotedStudentIds.has(e.studentId)
  );
  const promoted = allActiveEnrollments.filter((e) =>
    promotedStudentIds.has(e.studentId)
  );

  return { pending, promoted };
}
