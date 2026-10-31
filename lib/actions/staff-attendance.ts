"use server";

import { db } from "@/lib/db";
import { users, staffAttendance } from "@/lib/db/schema";
import { and, eq, inArray, between, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { requireAdmin, requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "tutor",
  "school_admin",
  "madrasa_admin",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

function getTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTimeString(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Check if current user is staff and if they have checked in today */
export async function getStaffCheckInStatus() {
  const session = await auth();
  if (!session?.user) {
    return { isStaff: false, checkedIn: false, checkInTime: null, date: null };
  }

  const role = session.user.role as StaffRole;
  if (!STAFF_ROLES.includes(role)) {
    return { isStaff: false, checkedIn: false, checkInTime: null, date: null };
  }

  const today = getTodayDateString();

  const record = await db.query.staffAttendance.findFirst({
    where: and(
      eq(staffAttendance.userId, session.user.id),
      eq(staffAttendance.date, today)
    ),
  });

  return {
    isStaff: true,
    checkedIn: !!record && record.status === "present",
    status: record?.status ?? null,
    checkInTime: record ? formatTimeString(record.createdAt) : null,
    date: today,
  };
}

/** Staff self check-in */
export async function checkInStaff(remarks?: string) {
  const session = await requireRole([
    "tutor",
    "admin",
    "super_admin",
    "school_admin",
    "madrasa_admin",
  ]);

  const today = getTodayDateString();

  const existing = await db.query.staffAttendance.findFirst({
    where: and(
      eq(staffAttendance.userId, session.user.id),
      eq(staffAttendance.date, today)
    ),
  });

  if (existing) {
    if (existing.status === "present") {
      return {
        success: false,
        error: `Already checked in today at ${formatTimeString(existing.createdAt)}`,
      };
    }
    // Update existing (e.g. if previously marked absent)
    const [updated] = await db
      .update(staffAttendance)
      .set({
        status: "present",
        remarks: remarks?.trim() || "Self check-in",
        recordedBy: session.user.id,
        createdAt: new Date(),
      })
      .where(eq(staffAttendance.id, existing.id))
      .returning();

    await logActivity(
      session.user.id,
      "staff_attendance.check_in",
      "staff_attendance",
      updated.id,
      { date: today, time: formatTimeString(updated.createdAt) }
    );

    revalidatePath("/");
    revalidatePath("/admin/attendance/staff");
    revalidatePath("/tutor");
    return { success: true, checkInTime: formatTimeString(updated.createdAt) };
  }

  const [record] = await db
    .insert(staffAttendance)
    .values({
      userId: session.user.id,
      date: today,
      status: "present",
      remarks: remarks?.trim() || "Self check-in",
      recordedBy: session.user.id,
      createdAt: new Date(),
    })
    .returning();

  await logActivity(
    session.user.id,
    "staff_attendance.check_in",
    "staff_attendance",
    record.id,
    { date: today, time: formatTimeString(record.createdAt) }
  );

  revalidatePath("/");
  revalidatePath("/admin/attendance/staff");
  revalidatePath("/tutor");
  return { success: true, checkInTime: formatTimeString(record.createdAt) };
}

const adminRecordSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "leave"]),
  leaveType: z.enum(["sick_leave", "casual_leave", "approved_leave"]).optional().nullable(),
  remarks: z.string().max(255).optional().nullable(),
});

/** Admin marks or overrides a staff member's attendance */
export async function adminRecordStaffAttendance(input: unknown) {
  const session = await requireAdmin();
  const parsed = adminRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { userId, date, status, leaveType, remarks } = parsed.data;

  const existing = await db.query.staffAttendance.findFirst({
    where: and(
      eq(staffAttendance.userId, userId),
      eq(staffAttendance.date, date)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(staffAttendance)
      .set({
        status,
        leaveType: status === "leave" ? leaveType ?? null : null,
        remarks: remarks ?? null,
        recordedBy: session.user.id,
      })
      .where(eq(staffAttendance.id, existing.id))
      .returning();

    await logActivity(
      session.user.id,
      "staff_attendance.admin_update",
      "staff_attendance",
      updated.id,
      { userId, date, status, leaveType, remarks }
    );
  } else {
    const [created] = await db
      .insert(staffAttendance)
      .values({
        userId,
        date,
        status,
        leaveType: status === "leave" ? leaveType ?? null : null,
        remarks: remarks ?? null,
        recordedBy: session.user.id,
        createdAt: new Date(),
      })
      .returning();

    await logActivity(
      session.user.id,
      "staff_attendance.admin_record",
      "staff_attendance",
      created.id,
      { userId, date, status, leaveType, remarks }
    );
  }

  revalidatePath("/admin/attendance/staff");
  revalidatePath("/admin/reports/attendance");
  return { success: true };
}

/** Daily Attendance Report Data for Admin */
export async function getStaffDailyAttendanceData(
  dateStr?: string,
  roleFilter?: string
) {
  await requireAdmin();
  const selectedDate = dateStr || getTodayDateString();

  const allStaffUsers = await db.query.users.findMany({
    where: and(
      eq(users.isActive, true),
      inArray(users.role, [...STAFF_ROLES])
    ),
    columns: {
      id: true,
      username: true,
      email: true,
      role: true,
      lastLoginAt: true,
    },
    orderBy: [asc(users.role), asc(users.username)],
  });

  const filteredStaff =
    roleFilter && roleFilter !== "all"
      ? allStaffUsers.filter((u) => u.role === roleFilter)
      : allStaffUsers;

  const attendanceRecordsForDate = await db.query.staffAttendance.findMany({
    where: eq(staffAttendance.date, selectedDate),
    with: {
      recordedByUser: {
        columns: { username: true },
      },
    },
  });

  const attendanceMap = new Map(
    attendanceRecordsForDate.map((r) => [r.userId, r])
  );

  const staffRows = filteredStaff.map((staff) => {
    const record = attendanceMap.get(staff.id);
    const isPresent = record?.status === "present";
    const isLeave = record?.status === "leave";
    const isAbsent = record?.status === "absent" || (!record && selectedDate <= getTodayDateString());

    return {
      userId: staff.id,
      username: staff.username,
      email: staff.email,
      role: staff.role,
      status: (record?.status ?? "unmarked") as "present" | "absent" | "leave" | "unmarked",
      leaveType: record?.leaveType ?? null,
      remarks: record?.remarks ?? null,
      checkInTime: record?.createdAt && isPresent ? formatTimeString(record.createdAt) : null,
      recordedBy: record?.recordedByUser?.username ?? null,
      hasRecord: !!record,
    };
  });

  const totalStaff = staffRows.length;
  const presentCount = staffRows.filter((r) => r.status === "present").length;
  const leaveCount = staffRows.filter((r) => r.status === "leave").length;
  const absentCount = staffRows.filter(
    (r) => r.status === "absent" || (r.status === "unmarked" && selectedDate <= getTodayDateString())
  ).length;

  const attendanceRate =
    totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  return {
    selectedDate,
    totalStaff,
    presentCount,
    absentCount,
    leaveCount,
    attendanceRate,
    staffRows,
  };
}

/** Monthly Attendance Report Matrix Data for Admin */
export async function getStaffMonthlyAttendanceData(
  yearInput?: number,
  monthInput?: number,
  roleFilter?: string
) {
  await requireAdmin();

  const now = new Date();
  const year = yearInput ?? now.getFullYear();
  const month = monthInput ?? now.getMonth() + 1;

  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);
  const todayStr = getTodayDateString();

  const allStaffUsers = await db.query.users.findMany({
    where: and(
      eq(users.isActive, true),
      inArray(users.role, [...STAFF_ROLES])
    ),
    columns: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
    orderBy: [asc(users.role), asc(users.username)],
  });

  const filteredStaff =
    roleFilter && roleFilter !== "all"
      ? allStaffUsers.filter((u) => u.role === roleFilter)
      : allStaffUsers;

  const monthlyRecords = await db.query.staffAttendance.findMany({
    where: between(staffAttendance.date, monthStart, monthEnd),
  });

  // userId -> Map(dayNumber -> record)
  const attendanceMap = new Map<string, Map<number, typeof monthlyRecords[0]>>();
  for (const rec of monthlyRecords) {
    if (!attendanceMap.has(rec.userId)) {
      attendanceMap.set(rec.userId, new Map());
    }
    const day = parseInt(rec.date.split("-")[2], 10);
    attendanceMap.get(rec.userId)!.set(day, rec);
  }

  // Calculate past/current working days up to today
  let pastDaysInMonth = 0;
  for (const d of days) {
    const curDateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (curDateStr <= todayStr) {
      pastDaysInMonth++;
    }
  }

  const staffMatrix = filteredStaff.map((staff) => {
    const userDaysMap = attendanceMap.get(staff.id) ?? new Map();
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    const daysData = days.map((d) => {
      const curDateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFuture = curDateStr > todayStr;
      const rec = userDaysMap.get(d);

      let status: "present" | "absent" | "leave" | "future" | "unmarked" = "unmarked";
      if (rec) {
        status = rec.status;
        if (rec.status === "present") presentCount++;
        else if (rec.status === "leave") leaveCount++;
        else if (rec.status === "absent") absentCount++;
      } else if (isFuture) {
        status = "future";
      } else {
        status = "absent";
        absentCount++;
      }

      return {
        day: d,
        date: curDateStr,
        status,
        checkInTime: rec?.createdAt && rec.status === "present" ? formatTimeString(rec.createdAt) : null,
        remarks: rec?.remarks ?? null,
      };
    });

    const evaluatedDays = Math.max(1, pastDaysInMonth);
    const rate = Math.round((presentCount / evaluatedDays) * 100);

    return {
      userId: staff.id,
      username: staff.username,
      email: staff.email,
      role: staff.role,
      daysData,
      presentCount,
      absentCount,
      leaveCount,
      rate,
    };
  });

  const totalStaff = staffMatrix.length;
  const avgAttendance =
    totalStaff > 0
      ? Math.round(
          staffMatrix.reduce((acc, curr) => acc + curr.rate, 0) / totalStaff
        )
      : 0;

  return {
    year,
    month,
    monthName: new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    }),
    days,
    totalStaff,
    pastDaysInMonth,
    avgAttendance,
    staffMatrix,
  };
}
