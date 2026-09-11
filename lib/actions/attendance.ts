"use server";

import { db } from "@/lib/db";
import { attendanceRecords } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
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
  
  // Soft-delete legacy record if it exists
  await db.update(attendanceRecords)
    .set({ deletedAt: new Date(), deletedBy: session.user.id })
    .where(
      and(
        eq(attendanceRecords.studentId, d.studentId),
        eq(attendanceRecords.date, d.date),
        isNull(attendanceRecords.session),
        isNull(attendanceRecords.deletedAt)
      )
    );

  let recordId;

  if (d.status === "unmarked") {
    // Explicit clear operation for this session
    await db.update(attendanceRecords)
      .set({ deletedAt: new Date(), deletedBy: session.user.id })
      .where(
        and(
          eq(attendanceRecords.studentId, d.studentId),
          eq(attendanceRecords.date, d.date),
          eq(attendanceRecords.session, d.session),
          isNull(attendanceRecords.deletedAt)
        )
      );
  } else {
    // Upsert the specific FN/AN session
    const [record] = await db
      .insert(attendanceRecords)
      .values({
        studentId: d.studentId,
        classId: d.classId,
        track: d.track,
        date: d.date,
        session: d.session,
        status: d.status,
        absenceReasonId: d.absenceReasonId || null,
        recordedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [
          attendanceRecords.studentId,
          attendanceRecords.classId,
          attendanceRecords.date,
          attendanceRecords.session,
        ],
        set: {
          status: d.status,
          absenceReasonId: d.absenceReasonId || null,
          recordedBy: session.user.id,
          updatedAt: new Date(),
          deletedAt: null, // restore if it was previously soft-deleted
        },
      })
      .returning();
      
    recordId = record.id;
  }

  await logActivity(
    session.user.id,
    "attendance.mark",
    "attendance_record",
    recordId
  );

  revalidatePath("/tutor/attendance");
  revalidatePath("/admin/attendance");
  return { success: true };
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
      // Soft-delete legacy record if it exists
      await tx.update(attendanceRecords)
        .set({ deletedAt: new Date(), deletedBy: session.user.id })
        .where(
          and(
            eq(attendanceRecords.studentId, entry.studentId),
            eq(attendanceRecords.date, date),
            isNull(attendanceRecords.session),
            isNull(attendanceRecords.deletedAt)
          )
        );

      if (entry.status === "unmarked") {
        await tx.update(attendanceRecords)
          .set({ deletedAt: new Date(), deletedBy: session.user.id })
          .where(
            and(
              eq(attendanceRecords.studentId, entry.studentId),
              eq(attendanceRecords.date, date),
              eq(attendanceRecords.session, entry.session),
              isNull(attendanceRecords.deletedAt)
            )
          );
      } else {
        const [record] = await tx
          .insert(attendanceRecords)
          .values({
            studentId: entry.studentId,
            classId,
            track,
            date,
            session: entry.session,
            status: entry.status,
            absenceReasonId: entry.absenceReasonId || null,
            recordedBy: session.user.id,
          })
          .onConflictDoUpdate({
            target: [
              attendanceRecords.studentId,
              attendanceRecords.classId,
              attendanceRecords.date,
              attendanceRecords.session,
            ],
            set: {
              status: entry.status,
              absenceReasonId: entry.absenceReasonId || null,
              recordedBy: session.user.id,
              updatedAt: new Date(),
              deletedAt: null, // restore if soft-deleted
            },
          })
          .returning();
        results.push(record);
      }
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
