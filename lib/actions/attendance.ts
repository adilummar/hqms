"use server";

import { db } from "@/lib/db";
import { attendanceRecords } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import {
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
} from "@/lib/validators/attendance.schema";
import { revalidatePath } from "next/cache";

export async function markAttendance(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = markAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  const [record] = await db
    .insert(attendanceRecords)
    .values({
      studentId: d.studentId,
      classId: d.classId,
      track: d.track,
      date: d.date,
      status: d.status,
      leaveType: d.leaveType ?? null,
      remarks: d.remarks ?? null,
      recordedBy: session.user.id,
    })
    .onConflictDoUpdate({
      target: [
        attendanceRecords.studentId,
        attendanceRecords.classId,
        attendanceRecords.date,
      ],
      set: {
        status: d.status,
        leaveType: d.leaveType ?? null,
        remarks: d.remarks ?? null,
        recordedBy: session.user.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity(
    session.user.id,
    "attendance.mark",
    "attendance_record",
    record.id
  );

  revalidatePath("/tutor/attendance");
  revalidatePath("/admin/attendance");
  return { success: true, data: record };
}

export async function bulkMarkAttendance(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = bulkMarkAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { classId, track, date, entries } = parsed.data;

  const records = await db.transaction(async (tx) => {
    const results = [];
    for (const entry of entries) {
      const [record] = await tx
        .insert(attendanceRecords)
        .values({
          studentId: entry.studentId,
          classId,
          track,
          date,
          status: entry.status,
          leaveType: entry.leaveType ?? null,
          remarks: entry.remarks ?? null,
          recordedBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: [
            attendanceRecords.studentId,
            attendanceRecords.classId,
            attendanceRecords.date,
          ],
          set: {
            status: entry.status,
            leaveType: entry.leaveType ?? null,
            remarks: entry.remarks ?? null,
            recordedBy: session.user.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      results.push(record);
    }
    return results;
  });

  await logActivity(
    session.user.id,
    "attendance.bulk_mark",
    "attendance_record",
    undefined,
    { classId, date, count: entries.length }
  );

  revalidatePath("/tutor/attendance");
  revalidatePath("/admin/attendance");
  return { success: true, data: records };
}
