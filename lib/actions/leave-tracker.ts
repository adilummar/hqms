"use server";

import { db } from "@/lib/db";
import {
  leavePeriods,
  leavePeriodDays,
  leaveActivities,
  leaveDayActivitySuspensions,
  leaveActivityResponses,
  students,
  enrollments,
} from "@/lib/db/schema";
import { requireRole, getParentStudentId } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";


// ── Leave Periods ─────────────────────────────────────────────────────────────

const createLeavePeriodSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string(), // "YYYY-MM-DD"
  endDate: z.string(),
});

export async function createLeavePeriod(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = createLeavePeriodSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid data" };

  const { name, startDate, endDate } = parsed.data;

  // Create the period
  const [period] = await db
    .insert(leavePeriods)
    .values({
      name,
      startDate,
      endDate,
      isActive: false,
      createdBy: session.user.id,
    })
    .returning();

  // Auto-generate day rows from startDate to endDate
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayRows: {
    leavePeriodId: string;
    dayNumber: number;
    date: string;
  }[] = [];
  let current = new Date(start);
  let dayNum = 1;
  while (current <= end) {
    dayRows.push({
      leavePeriodId: period.id,
      dayNumber: dayNum,
      date: current.toISOString().split("T")[0],
    });
    current.setDate(current.getDate() + 1);
    dayNum++;
  }
  if (dayRows.length > 0) {
    await db.insert(leavePeriodDays).values(dayRows);
  }

  await logActivity(session.user.id, "leave_period.create", "leave_periods", period.id);
  revalidatePath("/admin/leave-tracker/settings");
  return { success: true, id: period.id };
}

export async function activateLeavePeriod(periodId: string) {
  const session = await requireRole(["admin", "super_admin"]);

  // Deactivate all others
  await db.update(leavePeriods).set({ isActive: false, updatedAt: new Date() });
  // Activate target
  await db
    .update(leavePeriods)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(leavePeriods.id, periodId));

  await logActivity(session.user.id, "leave_period.activate", "leave_periods", periodId);
  revalidatePath("/admin/leave-tracker");
  revalidatePath("/parent/leave-tracker");
  revalidatePath("/tutor/hifz");
  return { success: true };
}

export async function deactivateLeavePeriod(periodId: string) {
  const session = await requireRole(["admin", "super_admin"]);

  await db
    .update(leavePeriods)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(leavePeriods.id, periodId));

  await logActivity(session.user.id, "leave_period.deactivate", "leave_periods", periodId);
  // Revalidate everywhere that checks for an active leave period
  revalidatePath("/admin/leave-tracker");
  revalidatePath("/admin/leave-tracker/settings");
  revalidatePath("/parent/leave-tracker");
  revalidatePath("/tutor/hifz");
  revalidatePath("/tutor/hifz/bulk");
  return { success: true };
}


export async function deleteLeavePeriod(periodId: string) {
  const session = await requireRole(["admin", "super_admin"]);
  await db.delete(leavePeriods).where(eq(leavePeriods.id, periodId));
  await logActivity(session.user.id, "leave_period.delete", "leave_periods", periodId);
  revalidatePath("/admin/leave-tracker/settings");
  return { success: true };
}

export async function getLeavePeriods() {
  const periods = await db.query.leavePeriods.findMany({
    orderBy: desc(leavePeriods.createdAt),
    with: {
      days: {
        orderBy: asc(leavePeriodDays.dayNumber),
        with: { suspensions: true },
      },
    },
  });

  // Lazy deactivation of expired active periods
  const today = new Date().toISOString().split("T")[0];
  let needsRevalidate = false;
  
  for (const period of periods) {
    if (period.isActive && period.endDate < today) {
      await db.update(leavePeriods).set({ isActive: false }).where(eq(leavePeriods.id, period.id));
      period.isActive = false;
      needsRevalidate = true;
    }
  }

  if (needsRevalidate) {
    // We do not revalidate here to avoid loops, the database is now correct for future loads
  }

  return periods;
}

export async function getActiveLeavePeriod() {
  const active = await db.query.leavePeriods.findFirst({
    where: eq(leavePeriods.isActive, true),
    with: {
      days: {
        orderBy: asc(leavePeriodDays.dayNumber),
        with: { suspensions: { with: { activity: true } } },
      },
    },
  });

  if (active) {
    const today = new Date().toISOString().split("T")[0];
    if (active.endDate < today) {
      // Auto-deactivate
      await db.update(leavePeriods).set({ isActive: false }).where(eq(leavePeriods.id, active.id));
      return undefined;
    }
  }
  return active;
}

// ── Leave Period Day Label ────────────────────────────────────────────────────

export async function updateDayLabel(dayId: string, label: string) {
  await requireRole(["admin", "super_admin"]);
  await db
    .update(leavePeriodDays)
    .set({ label: label || null })
    .where(eq(leavePeriodDays.id, dayId));
  revalidatePath("/admin/leave-tracker/settings");
  return { success: true };
}

// ── Activity Suspensions ──────────────────────────────────────────────────────

export async function toggleActivitySuspension(
  leavePeriodDayId: string,
  activityId: string,
  suspend: boolean
) {
  await requireRole(["admin", "super_admin"]);

  if (suspend) {
    await db
      .insert(leaveDayActivitySuspensions)
      .values({ leavePeriodDayId, activityId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(leaveDayActivitySuspensions)
      .where(
        and(
          eq(leaveDayActivitySuspensions.leavePeriodDayId, leavePeriodDayId),
          eq(leaveDayActivitySuspensions.activityId, activityId)
        )
      );
  }

  revalidatePath("/admin/leave-tracker/settings");
  revalidatePath("/parent/leave-tracker");
  return { success: true };
}
export async function savePeriodSuspensions(
  periodId: string,
  suspensions: { dayId: string; activityId: string }[]
) {
  const session = await requireRole(["admin", "super_admin"]);

  const days = await db.query.leavePeriodDays.findMany({
    where: eq(leavePeriodDays.leavePeriodId, periodId),
  });
  const dayIds = days.map((d) => d.id);

  await db.transaction(async (tx) => {
    if (dayIds.length > 0) {
      await tx
        .delete(leaveDayActivitySuspensions)
        .where(inArray(leaveDayActivitySuspensions.leavePeriodDayId, dayIds));
    }

    if (suspensions.length > 0) {
      await tx.insert(leaveDayActivitySuspensions).values(
        suspensions.map((s) => ({
          leavePeriodDayId: s.dayId,
          activityId: s.activityId,
        }))
      );
    }
  });

  revalidatePath("/admin/leave-tracker/settings");
  revalidatePath("/parent/leave-tracker");
  return { success: true };
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function getLeaveActivities() {
  return db.query.leaveActivities.findMany({
    where: eq(leaveActivities.isActive, true),
    orderBy: asc(leaveActivities.displayOrder),
  });
}

export async function getAllLeaveActivities() {
  return db.query.leaveActivities.findMany({
    orderBy: asc(leaveActivities.displayOrder),
  });
}

const createActivitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  icon: z.string().max(50).optional(),
  displayOrder: z.number().int().default(0),
  isSuspendedOnHoliday: z.boolean().default(false),
});

export async function createLeaveActivity(input: unknown) {
  await requireRole(["admin", "super_admin"]);
  const parsed = createActivitySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid data" };

  await db.insert(leaveActivities).values(parsed.data);
  revalidatePath("/admin/leave-tracker/settings");
  return { success: true };
}

export async function updateLeaveActivity(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    icon: string;
    displayOrder: number;
    isSuspendedOnHoliday: boolean;
    isActive: boolean;
  }>
) {
  await requireRole(["admin", "super_admin"]);
  await db
    .update(leaveActivities)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(leaveActivities.id, id));
  revalidatePath("/admin/leave-tracker/settings");
  return { success: true };
}

export async function deleteLeaveActivity(id: string) {
  await requireRole(["admin", "super_admin"]);
  await db.delete(leaveActivities).where(eq(leaveActivities.id, id));
  revalidatePath("/admin/leave-tracker/settings");
  return { success: true };
}

// ── Responses ─────────────────────────────────────────────────────────────────

export async function saveLeaveResponses(
  periodId: string,
  studentId: string,
  dayNumber: number,
  responses: { activityId: string; completed: boolean }[]
) {
  const session = await requireRole(["parent", "admin", "super_admin"]);

  // If parent, verify they own this student
  if (session.user.role === "parent") {
    const ownedStudentId = await getParentStudentId();
    if (ownedStudentId !== studentId) {
      return { success: false, error: "Unauthorized" };
    }
  }

  for (const r of responses) {
    await db
      .insert(leaveActivityResponses)
      .values({
        leavePeriodId: periodId,
        studentId,
        dayNumber,
        activityId: r.activityId,
        completed: r.completed,
        recordedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [
          leaveActivityResponses.leavePeriodId,
          leaveActivityResponses.studentId,
          leaveActivityResponses.dayNumber,
          leaveActivityResponses.activityId,
        ],
        set: {
          completed: r.completed,
          recordedBy: session.user.id,
          recordedAt: new Date(),
        },
      });
  }

  revalidatePath("/parent/leave-tracker");
  revalidatePath("/admin/leave-tracker");
  return { success: true };
}

// ── Query: Responses for a student in the active period ───────────────────────

export async function getStudentLeaveResponses(periodId: string, studentId: string) {
  return db.query.leaveActivityResponses.findMany({
    where: and(
      eq(leaveActivityResponses.leavePeriodId, periodId),
      eq(leaveActivityResponses.studentId, studentId)
    ),
    with: { activity: true },
  });
}

// ── Query: All responses for active period (admin overview) ───────────────────

export async function getAllLeaveResponses(periodId: string) {
  return db.query.leaveActivityResponses.findMany({
    where: eq(leaveActivityResponses.leavePeriodId, periodId),
    with: {
      student: {
        with: {
          enrollments: {
            where: eq(enrollments.status, "active"),
            with: { class: true },
          },
        },
      },
      activity: true,
    },
  });
}

// ── Query: All students with their class info ─────────────────────────────────

export async function getStudentsForLeaveTracker() {
  return db.query.students.findMany({
    where: eq(students.status, "active"),
    orderBy: asc(students.firstName),
    with: {
      enrollments: {
        where: eq(enrollments.status, "active"),
        with: { class: true },
      },
    },
  });
}

// ── Query: Student for a parent ───────────────────────────────────────────────

export async function getParentStudentForLeaveTracker() {
  const studentId = await getParentStudentId();
  return db.query.students.findFirst({
    where: eq(students.id, studentId),
    with: {
      enrollments: {
        where: eq(enrollments.status, "active"),
        with: { class: true },
      },
    },
  });
}
