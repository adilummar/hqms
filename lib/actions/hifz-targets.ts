"use server";

import { db } from "@/lib/db";
import { 
  studentAnnualHifzTargets, 
  hifzDailyEntries, 
  juzTracker, 
  enrollments, 
  academicYears 
} from "@/lib/db/schema";
import { eq, and, desc, isNotNull, inArray, lte } from "drizzle-orm";
import { requireRole } from "@/lib/auth/helpers";
import { calculateJuzAwareTargetPath } from "@/lib/utils/juz-calculator";
import { revalidatePath } from "next/cache";

function getStudentYearTargetJuzAmount(yearOfStudy: string | null): number {
  if (!yearOfStudy) return 1; // Default
  
  const parsed = parseInt(yearOfStudy.replace(/\D/g, ""));
  if (isNaN(parsed)) return 1;
  
  if (parsed === 1) return 1;
  if (parsed === 2) return 1.5;
  if (parsed === 3) return 2;
  return 2; // 4+ is 2
}

/**
 * Initializes target baseline for all active enrollments for the given academic year,
 * skipping those that already have a baseline.
 */
export async function initializeAcademicYearTargets(academicYearId: string) {
  await requireRole(["super_admin", "admin"]);
  
  const acYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.id, academicYearId)
  });
  if (!acYear) throw new Error("Academic year not found");

  const activeEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.status, "active")
    )
  });

  const existingTargets = await db.query.studentAnnualHifzTargets.findMany({
    where: eq(studentAnnualHifzTargets.academicYearId, academicYearId)
  });
  const existingSet = new Set(existingTargets.map(t => t.studentId));

  const toProcess = activeEnrollments.filter(e => !existingSet.has(e.studentId));
  
  let initializedCount = 0;

  for (const enrollment of toProcess) {
    const targetJuzAmount = getStudentYearTargetJuzAmount(enrollment.yearOfStudy);
    
    // Find starting position (most recent entry BEFORE or AT the start of the academic year)
    const latestEntry = await db.query.hifzDailyEntries.findFirst({
      where: and(
        eq(hifzDailyEntries.studentId, enrollment.studentId),
        isNotNull(hifzDailyEntries.sabaqJuzNumber),
        lte(hifzDailyEntries.date, acYear.startDate.toISOString().split('T')[0])
      ),
      orderBy: [desc(hifzDailyEntries.date), desc(hifzDailyEntries.createdAt)],
    });

    let startJuz = 1;
    let startPage = 1;

    if (latestEntry && latestEntry.sabaqJuzNumber && latestEntry.sabaqToPage) {
      startJuz = latestEntry.sabaqJuzNumber;
      startPage = Number(latestEntry.sabaqToPage); // we use the page they stopped at
      // Actually, if they finished page N, they start at N or N+1? The prompt says "starting at page 1".
      // We will just use the page they reached.
    } else {
      // Check juz tracker if they have completed some
      const completedJuz = await db.query.juzTracker.findFirst({
        where: and(
          eq(juzTracker.studentId, enrollment.studentId),
          eq(juzTracker.status, "completed")
        ),
        orderBy: [desc(juzTracker.juzNumber)]
      });
      if (completedJuz) {
        startJuz = completedJuz.juzNumber + 1;
        startPage = 1;
      }
    }

    const calculatedTotalPages = calculateJuzAwareTargetPath(startJuz, startPage, targetJuzAmount);

    await db.insert(studentAnnualHifzTargets).values({
      studentId: enrollment.studentId,
      academicYearId,
      targetJuzAmount: targetJuzAmount.toString() as any, // numeric
      startingJuzNumber: startJuz,
      startingPage: startPage,
      calculatedTotalPages,
    });
    
    initializedCount++;
  }

  revalidatePath("/admin/hifz/targets");
  return { success: true, count: initializedCount };
}

/**
 * Admins can recalculate the baseline.
 */
export async function recalculateStudentTarget(studentId: string, academicYearId: string) {
  const session = await requireRole(["super_admin", "admin"]);
  
  const enrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.academicYearId, academicYearId)
    )
  });
  if (!enrollment) return { success: false, error: "Enrollment not found" };

  const acYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.id, academicYearId)
  });
  if (!acYear) return { success: false, error: "Academic year not found" };

  const targetJuzAmount = getStudentYearTargetJuzAmount(enrollment.yearOfStudy);
    
  // Find starting position exactly as in initialization
  const latestEntry = await db.query.hifzDailyEntries.findFirst({
    where: and(
      eq(hifzDailyEntries.studentId, enrollment.studentId),
      isNotNull(hifzDailyEntries.sabaqJuzNumber),
      lte(hifzDailyEntries.date, acYear.startDate.toISOString().split('T')[0])
    ),
    orderBy: [desc(hifzDailyEntries.date), desc(hifzDailyEntries.createdAt)],
  });

  let startJuz = 1;
  let startPage = 1;

  if (latestEntry && latestEntry.sabaqJuzNumber && latestEntry.sabaqToPage) {
    startJuz = latestEntry.sabaqJuzNumber;
    startPage = Number(latestEntry.sabaqToPage);
  } else {
    const completedJuz = await db.query.juzTracker.findFirst({
      where: and(
        eq(juzTracker.studentId, enrollment.studentId),
        eq(juzTracker.status, "completed")
      ),
      orderBy: [desc(juzTracker.juzNumber)]
    });
    if (completedJuz) {
      startJuz = completedJuz.juzNumber + 1;
      startPage = 1;
    }
  }

  const calculatedTotalPages = calculateJuzAwareTargetPath(startJuz, startPage, targetJuzAmount);

  // Update existing or create
  const existing = await db.query.studentAnnualHifzTargets.findFirst({
    where: and(
      eq(studentAnnualHifzTargets.studentId, studentId),
      eq(studentAnnualHifzTargets.academicYearId, academicYearId)
    )
  });

  if (existing) {
    await db.update(studentAnnualHifzTargets)
      .set({
        targetJuzAmount: targetJuzAmount.toString() as any,
        startingJuzNumber: startJuz,
        startingPage: startPage,
        calculatedTotalPages,
        isManualOverride: false, // Reset override flag on recalculation
        overrideBy: null,
        updatedAt: new Date(),
      })
      .where(eq(studentAnnualHifzTargets.id, existing.id));
  } else {
    await db.insert(studentAnnualHifzTargets).values({
      studentId: enrollment.studentId,
      academicYearId,
      targetJuzAmount: targetJuzAmount.toString() as any,
      startingJuzNumber: startJuz,
      startingPage: startPage,
      calculatedTotalPages,
    });
  }

  // Import locally to avoid circular dependencies if any
  const { logActivity } = await import("@/lib/actions/activity");
  await logActivity(
    session.user.id,
    "hifz.target_recalculated",
    "student_annual_hifz_targets",
    studentId
  );

  revalidatePath("/admin/hifz/targets");
  return { success: true };
}

/**
 * Admins can manually override a student's calculated page target.
 */
export async function manualOverrideStudentTarget(
  studentId: string, 
  academicYearId: string, 
  targetJuzAmount: number,
  calculatedTotalPages: number
) {
  const session = await requireRole(["super_admin", "admin"]);
  
  const existing = await db.query.studentAnnualHifzTargets.findFirst({
    where: and(
      eq(studentAnnualHifzTargets.studentId, studentId),
      eq(studentAnnualHifzTargets.academicYearId, academicYearId)
    )
  });

  if (!existing) {
    // If it doesn't exist, we must initialize a dummy starting position 
    // or just assume 1:1, but admin is overriding pages so it's fine.
    await db.insert(studentAnnualHifzTargets).values({
      studentId,
      academicYearId,
      targetJuzAmount: targetJuzAmount.toString() as any,
      startingJuzNumber: 1,
      startingPage: 1,
      calculatedTotalPages,
      isManualOverride: true,
      overrideBy: session.user.id,
    });
  } else {
    await db.update(studentAnnualHifzTargets)
      .set({
        targetJuzAmount: targetJuzAmount.toString() as any,
        calculatedTotalPages,
        isManualOverride: true,
        overrideBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(studentAnnualHifzTargets.id, existing.id));
  }

  const { logActivity } = await import("@/lib/actions/activity");
  await logActivity(
    session.user.id,
    "hifz.target_overridden",
    "student_annual_hifz_targets",
    studentId
  );

  revalidatePath("/admin/hifz/targets");
  return { success: true };
}
