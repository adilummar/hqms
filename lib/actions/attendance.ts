"use server";

import { findInactiveStudentIds, INACTIVE_STUDENT_ERROR } from "@/lib/students/active";
import { db } from "@/lib/db";
import { attendanceRecords } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import {
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
} from "@/lib/validators/attendance.schema";
import { revalidatePath } from "next/cache";

/**
 * True when any of these students is inactive AND has no attendance record yet on that date
 * (new attendance for inactive students is blocked; correcting an existing record is allowed).
 */
async function inactiveWithoutRecord(studentIds: string[], date: string): Promise<boolean> {
  const inactive = await findInactiveStudentIds(studentIds);
  if (inactive.length === 0) return false;
  const existing = await db
    .select({ studentId: attendanceRecords.studentId })
    .from(attendanceRecords)
    .where(
      and(
        inArray(attendanceRecords.studentId, inactive),
        eq(attendanceRecords.date, date),
        isNull(attendanceRecords.deletedAt)
      )
    );
  const has = new Set(existing.map((e) => e.studentId));
  return inactive.some((id) => !has.has(id));
}

export async function markAttendance(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = markAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  if (d.status !== "unmarked") {
    const blocked = await inactiveWithoutRecord([d.studentId], d.date);
    if (blocked) return { success: false, error: INACTIVE_STUDENT_ERROR };
  }

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

  const blocked = await inactiveWithoutRecord(
    entries.filter((e) => e.status !== "unmarked").map((e) => e.studentId),
    date
  );
  if (blocked) return { success: false, error: INACTIVE_STUDENT_ERROR };

  let records;
  try {
  records = await db.transaction(async (tx) => {
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
  } catch (err) {
    console.error("[bulkMarkAttendance]", err);
    // Friday/Holiday need migration 0011 (adds the two enum values); the whole save rolls back.
    const msg = String((err as { message?: string })?.message ?? "");
    const cause = String((err as { cause?: { message?: string } })?.cause?.message ?? "");
    if (/invalid input value for enum/i.test(msg + cause))
      return { success: false, error: "Friday / Holiday attendance needs the database update (migration 0011). Nothing was saved." };
    return { success: false, error: "Could not save attendance. Nothing was changed." };
  }

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
