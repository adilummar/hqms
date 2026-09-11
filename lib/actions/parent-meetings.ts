"use server";

import { db } from "@/lib/db";
import {
  parentMeetings,
  parentMeetingAttendance,
  students,
  enrollments,
  classes,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { eq, and, inArray, desc } from "drizzle-orm";
import { z } from "zod";

// ── Validators ────────────────────────────────────────────────────────────────

const createMeetingSchema = z.object({
  title: z.string().min(2).max(150),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
});

const saveMeetingAttendanceSchema = z.object({
  meetingId: z.string().uuid(),
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(["ON_TIME", "LATE", "ABSENT_WITH_REASON", "ABSENT_WITHOUT_VALID_REASON"]),
      remarks: z.string().optional(),
    })
  ),
  extraRevalidatePaths: z.array(z.string()).optional(),
});

// ── Create a parent meeting (super_admin only) ────────────────────────────────

export async function createParentMeeting(input: unknown) {
  const session = await requireRole(["super_admin"]);
  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { title, meetingDate, description } = parsed.data;

  const [meeting] = await db
    .insert(parentMeetings)
    .values({
      title,
      meetingDate,
      description: description ?? null,
      createdBy: session.user.id,
    })
    .returning();

  await logActivity(
    session.user.id,
    "parent_meeting.create",
    "parent_meeting",
    meeting.id,
    { title, meetingDate }
  );

  try {
    const { notificationService } = await import("@/lib/services/notifications");
    const recipients = await notificationService.resolveMeetingAnnouncementRecipients();
    
    // Convert YYYY-MM-DD to readable date
    const dateObj = new Date(meetingDate);
    const dateString = dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

    await notificationService.createNotification({
      type: "parent_meeting_announced",
      title: "Parent Meeting Scheduled",
      body: `A parent meeting "${title}" has been scheduled for ${dateString}.`,
      entityType: "parent_meeting",
      entityId: meeting.id,
      deepLink: `/parent`,
      recipients,
      idempotencyKey: `parent_meeting_announced:${meeting.id}`,
    });
  } catch (err) {
    console.error("Failed to send meeting announcement notification:", err);
  }

  revalidatePath("/admin/settings/parent-meetings");
  return { success: true, data: meeting };
}

// ── Delete a parent meeting (super_admin only) ───────────────────────────────

export async function deleteParentMeeting(meetingId: string) {
  const session = await requireRole(["super_admin"]);

  await db.delete(parentMeetings).where(eq(parentMeetings.id, meetingId));

  await logActivity(
    session.user.id,
    "parent_meeting.delete",
    "parent_meeting",
    meetingId
  );

  revalidatePath("/admin/settings/parent-meetings");
  return { success: true };
}

// ── Get all meetings ─────────────────────────────────────────────────────────

export async function getAllParentMeetings() {
  return db.query.parentMeetings.findMany({
    orderBy: [desc(parentMeetings.meetingDate)],
    with: {
      attendanceRecords: { columns: { id: true } },
    },
  });
}

// ── Get meetings + existing attendance for a specific class (tutor view) ──────

export async function getMeetingRosterData(meetingId: string, classId: string) {
  await requireRole(["tutor", "admin", "super_admin"]);

  const [meeting, classEnrollments] = await Promise.all([
    db.query.parentMeetings.findFirst({
      where: eq(parentMeetings.id, meetingId),
    }),
    db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, classId), eq(enrollments.status, "active")),
    }),
  ]);

  if (!meeting) return null;

  const studentIds = classEnrollments.map((e) => e.studentId);

  const [studentsData, existingAttendance] = await Promise.all([
    studentIds.length > 0
      ? db.query.students.findMany({
          where: inArray(students.id, studentIds),
          columns: { id: true, studentCode: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    studentIds.length > 0
      ? db.query.parentMeetingAttendance.findMany({
          where: and(
            eq(parentMeetingAttendance.meetingId, meetingId),
            inArray(parentMeetingAttendance.studentId, studentIds)
          ),
        })
      : Promise.resolve([]),
  ]);

  return { meeting, students: studentsData, existingAttendance };
}

// ── Save parent meeting attendance (tutor) ───────────────────────────────────

export async function saveParentMeetingAttendance(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = saveMeetingAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { meetingId, entries } = parsed.data;

  // We'll record which entries genuinely changed status to notify afterwards
  const genuineTransitions: Array<typeof entries[0] & { idempotencyKey: string }> = [];

  // Pre-fetch existing records to compare states
  const studentIds = entries.map(e => e.studentId);
  const existingRecords = await db.query.parentMeetingAttendance.findMany({
    where: and(
      eq(parentMeetingAttendance.meetingId, meetingId),
      inArray(parentMeetingAttendance.studentId, studentIds)
    )
  });
  
  const existingMap = new Map(existingRecords.map(r => [r.studentId, r.status]));

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      const isAttended = entry.status === "ON_TIME" || entry.status === "LATE";
      const remarks = (entry.status === "ON_TIME") ? null : entry.remarks || null;
      
      const existingStatus = existingMap.get(entry.studentId);
      const isGenuineTransition = !existingStatus || existingStatus !== entry.status;

      const [updatedRecord] = await tx
        .insert(parentMeetingAttendance)
        .values({
          meetingId,
          studentId: entry.studentId,
          attended: isAttended,
          status: entry.status,
          remarks: remarks,
          recordedBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: [
            parentMeetingAttendance.meetingId,
            parentMeetingAttendance.studentId,
          ],
          set: {
            attended: isAttended,
            status: entry.status,
            remarks: remarks,
            recordedBy: session.user.id,
            updatedAt: new Date(),
          },
        })
        .returning({ updatedAt: parentMeetingAttendance.updatedAt });
        
      if (isGenuineTransition) {
        // Safe transition key relying on exact DB timestamp
        genuineTransitions.push({
          ...entry,
          idempotencyKey: `parent_meeting_attendance:${meetingId}:${entry.studentId}:${entry.status}:${updatedRecord.updatedAt.getTime()}`
        });
      }
    }
  });

  await logActivity(
    session.user.id,
    "parent_meeting.attendance_saved",
    "parent_meeting",
    meetingId,
    { count: entries.length }
  );

  // Send notifications ONLY for genuine attendance updates
  try {
    const { notificationService } = await import("@/lib/services/notifications");
    
    if (genuineTransitions.length > 0) {
      const meeting = await db.query.parentMeetings.findFirst({
        where: eq(parentMeetings.id, meetingId)
      });

      if (meeting) {
        for (const entry of genuineTransitions) {
          const recipients = await notificationService.resolveMeetingAttendanceRecipients(entry.studentId);
          
          const statusMap: Record<string, string> = {
            "ON_TIME": "On Time",
            "LATE": "Late",
            "ABSENT_WITH_REASON": "Absent with Reason",
            "ABSENT_WITHOUT_VALID_REASON": "Absent without Valid Reason",
          };
          const statusText = statusMap[entry.status] || entry.status;
          
          let body = `Your attendance for the parent meeting "${meeting.title}" has been recorded as ${statusText}.`;
          if (entry.status === "ABSENT_WITH_REASON" && entry.remarks) {
            body += ` Reason: ${entry.remarks}`;
          }

          await notificationService.createNotification({
            type: "parent_meeting_attendance_recorded",
            title: "Parent Meeting Attendance Updated",
            body,
            entityType: "parent_meeting_attendance",
            entityId: meetingId,
            deepLink: `/parent`,
            recipients,
            idempotencyKey: entry.idempotencyKey,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send meeting attendance notifications:", err);
  }

  revalidatePath("/tutor/parent-meetings");
  revalidatePath("/admin/settings/parent-meetings");
  revalidatePath("/admin/parent-meetings");

  // Revalidate any extra paths supplied by the caller (e.g. admin page)
  for (const p of parsed.data.extraRevalidatePaths ?? []) {
    revalidatePath(p);
  }

  return { success: true };
}

// ── Get meeting attendance for a student (parent portal) ─────────────────────

export async function getStudentMeetingHistory(studentId: string) {
  return db.query.parentMeetingAttendance.findMany({
    where: eq(parentMeetingAttendance.studentId, studentId),
    with: {
      meeting: { columns: { title: true, meetingDate: true } },
    },
    orderBy: [desc(parentMeetingAttendance.createdAt)],
  });
}
