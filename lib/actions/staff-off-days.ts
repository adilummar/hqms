"use server";

import { db } from "@/lib/db";
import { settings, staffOffDays } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import {
  WEEKLY_OFF_KEY,
  getWeeklyOffDays,
} from "@/lib/services/staff-attendance-data";
import { dateRange, parseWeeklyOff, toIstDate } from "@/lib/services/staff-sessions";

export interface OffDayItem {
  id: string;
  date: string;
  scope: "both" | "FN" | "AN";
  type: string;
  reason: string | null;
}

export interface OffDaySettings {
  weeklyOffDays: number[];
  upcoming: OffDayItem[];
  todayDate: string;
}

const MAX_RANGE_DAYS = 120;

/** Weekly-off setting and non-working days from today onwards (plus the last 30 days). */
export async function getStaffOffDaySettings(): Promise<OffDaySettings> {
  await requireAdmin();
  const todayDate = toIstDate(new Date());
  const [weeklyOffDays, rows] = await Promise.all([
    getWeeklyOffDays(),
    db
      .select()
      .from(staffOffDays)
      .where(gte(staffOffDays.date, shiftDays(todayDate, -30)))
      .orderBy(asc(staffOffDays.date)),
  ]);
  return {
    weeklyOffDays,
    todayDate,
    upcoming: rows.map((r) => ({
      id: r.id,
      date: r.date,
      scope: r.scope === "FN" || r.scope === "AN" ? r.scope : "both",
      type: r.type,
      reason: r.reason,
    })),
  };
}

function shiftDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const addOffDaysSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scope: z.enum(["both", "FN", "AN"]).default("both"),
    type: z.enum(["holiday", "students_leave", "other"]).default("holiday"),
    reason: z.string().trim().max(150).optional().nullable(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "End date must be on or after start date" });

/** Admin adds a single non-working day or a date range. Existing rows are kept. */
export async function addStaffOffDays(input: unknown) {
  const session = await requireAdmin();
  const parsed = addOffDaysSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { startDate, endDate, scope, type, reason } = parsed.data;
  const dates = dateRange(startDate, endDate);
  if (dates.length > MAX_RANGE_DAYS) {
    return { success: false, error: `A range can cover at most ${MAX_RANGE_DAYS} days` };
  }

  const inserted = await db
    .insert(staffOffDays)
    .values(
      dates.map((date) => ({
        date,
        scope,
        type,
        reason: reason || null,
        createdBy: session.user.id,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: staffOffDays.id });

  await logActivity(session.user.id, "staff_attendance.off_days_add", "staff_off_day", undefined, {
    startDate,
    endDate,
    scope,
    type,
    reason,
    added: inserted.length,
  });

  revalidatePath("/admin/attendance/staff");
  return { success: true, added: inserted.length, skipped: dates.length - inserted.length };
}

/** Admin removes one off-day row. */
export async function deleteStaffOffDay(id: string) {
  const session = await requireAdmin();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { success: false, error: "Invalid id" };

  const [removed] = await db
    .delete(staffOffDays)
    .where(eq(staffOffDays.id, parsedId.data))
    .returning();
  if (!removed) return { success: false, error: "Not found" };

  await logActivity(session.user.id, "staff_attendance.off_day_remove", "staff_off_day", removed.id, {
    date: removed.date,
    scope: removed.scope,
  });
  revalidatePath("/admin/attendance/staff");
  return { success: true };
}

/** Admin sets the weekly off days (0 = Sunday … 6 = Saturday). Empty = none. */
export async function setStaffWeeklyOffDays(days: number[]) {
  const session = await requireAdmin();
  const clean = Array.from(new Set(days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort();
  const value = clean.join(",");

  await db
    .insert(settings)
    .values({
      key: WEEKLY_OFF_KEY,
      value,
      description: "Weekly off days for staff attendance (0=Sunday … 6=Saturday, comma-separated).",
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });

  await logActivity(session.user.id, "staff_attendance.weekly_off_set", "settings", undefined, {
    weeklyOffDays: parseWeeklyOff(value),
  });
  revalidatePath("/admin/attendance/staff");
  return { success: true };
}
