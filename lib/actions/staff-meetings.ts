"use server";

import { db } from "@/lib/db";
import { staffMeetings, staffMeetingAttendance, users } from "@/lib/db/schema";
import { requireAdmin, requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { STAFF_ROLES } from "@/lib/constants/staff";

const createStaffMeetingSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(150),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  meetingTime: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

const updateMinutesSchema = z.object({
  meetingId: z.string().uuid(),
  minutes: z.string().trim().optional().nullable(),
  decisions: z.string().trim().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
});

const updateStaffMeetingDetailsSchema = z.object({
  meetingId: z.string().uuid(),
  title: z.string().trim().min(2).max(150),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meetingTime: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
});

/** Create a new staff meeting */
export async function createStaffMeeting(input: unknown) {
  const session = await requireAdmin();
  const parsed = createStaffMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { title, meetingDate, meetingTime, location, description } = parsed.data;

  const [meeting] = await db
    .insert(staffMeetings)
    .values({
      title,
      meetingDate,
      meetingTime: meetingTime || null,
      location: location || null,
      description: description || null,
      status: "scheduled",
      createdBy: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Pre-populate attendance roster for all active staff
  const activeStaff = await db.query.users.findMany({
    where: and(
      eq(users.isActive, true),
      inArray(users.role, [...STAFF_ROLES])
    ),
    columns: { id: true },
  });

  if (activeStaff.length > 0) {
    await db
      .insert(staffMeetingAttendance)
      .values(
        activeStaff.map((staff) => ({
          meetingId: meeting.id,
          userId: staff.id,
          attended: true,
          recordedBy: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .onConflictDoNothing();
  }

  await logActivity(
    session.user.id,
    "staff_meeting.create",
    "staff_meeting",
    meeting.id,
    { title, meetingDate }
  );

  revalidatePath("/admin/staff-meetings");
  revalidatePath("/tutor/staff-meetings");
  return { success: true, data: meeting };
}

/** Save or update minutes and decisions ("disitions") of a staff meeting */
export async function updateStaffMeetingMinutes(input: unknown) {
  const session = await requireAdmin();
  const parsed = updateMinutesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { meetingId, minutes, decisions, status } = parsed.data;

  const [updated] = await db
    .update(staffMeetings)
    .set({
      minutes: minutes || null,
      decisions: decisions || null,
      status: status || (decisions || minutes ? "completed" : undefined),
      updatedAt: new Date(),
    })
    .where(eq(staffMeetings.id, meetingId))
    .returning();

  await logActivity(
    session.user.id,
    "staff_meeting.update_minutes",
    "staff_meeting",
    meetingId,
    { hasMinutes: !!minutes, hasDecisions: !!decisions, status: updated.status }
  );

  revalidatePath("/admin/staff-meetings");
  revalidatePath(`/admin/staff-meetings/${meetingId}`);
  revalidatePath("/tutor/staff-meetings");
  return { success: true, data: updated };
}

/** Update meeting basic details */
export async function updateStaffMeetingDetails(input: unknown) {
  const session = await requireAdmin();
  const parsed = updateStaffMeetingDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { meetingId, title, meetingDate, meetingTime, location, description, status } = parsed.data;

  const [updated] = await db
    .update(staffMeetings)
    .set({
      title,
      meetingDate,
      meetingTime: meetingTime || null,
      location: location || null,
      description: description || null,
      status: status || undefined,
      updatedAt: new Date(),
    })
    .where(eq(staffMeetings.id, meetingId))
    .returning();

  await logActivity(
    session.user.id,
    "staff_meeting.update_details",
    "staff_meeting",
    meetingId,
    { title, meetingDate, status: updated.status }
  );

  revalidatePath("/admin/staff-meetings");
  revalidatePath(`/admin/staff-meetings/${meetingId}`);
  revalidatePath("/tutor/staff-meetings");
  return { success: true, data: updated };
}

/** Delete a staff meeting */
export async function deleteStaffMeeting(meetingId: string) {
  const session = await requireAdmin();

  const meeting = await db.query.staffMeetings.findFirst({
    where: eq(staffMeetings.id, meetingId),
  });

  if (!meeting) {
    return { success: false, error: "Meeting not found" };
  }

  await db.delete(staffMeetings).where(eq(staffMeetings.id, meetingId));

  await logActivity(
    session.user.id,
    "staff_meeting.delete",
    "staff_meeting",
    meetingId,
    { title: meeting.title }
  );

  revalidatePath("/admin/staff-meetings");
  revalidatePath("/tutor/staff-meetings");
  return { success: true };
}

/** Save staff attendance for a meeting */
export async function saveStaffMeetingAttendance(
  meetingId: string,
  entries: { userId: string; attended: boolean; remarks?: string }[]
) {
  const session = await requireAdmin();

  for (const entry of entries) {
    const existing = await db.query.staffMeetingAttendance.findFirst({
      where: and(
        eq(staffMeetingAttendance.meetingId, meetingId),
        eq(staffMeetingAttendance.userId, entry.userId)
      ),
    });

    if (existing) {
      await db
        .update(staffMeetingAttendance)
        .set({
          attended: entry.attended,
          remarks: entry.remarks ?? null,
          recordedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(staffMeetingAttendance.id, existing.id));
    } else {
      await db.insert(staffMeetingAttendance).values({
        meetingId,
        userId: entry.userId,
        attended: entry.attended,
        remarks: entry.remarks ?? null,
        recordedBy: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  await logActivity(
    session.user.id,
    "staff_meeting.attendance_update",
    "staff_meeting",
    meetingId,
    { count: entries.length }
  );

  revalidatePath("/admin/staff-meetings");
  revalidatePath(`/admin/staff-meetings/${meetingId}`);
  revalidatePath("/tutor/staff-meetings");
  return { success: true };
}

/** Get meeting with full attendance & minutes details */
export async function getStaffMeetingDetails(meetingId: string) {
  await requireRole(["admin", "super_admin", "tutor", "school_admin", "madrasa_admin"]);

  const meeting = await db.query.staffMeetings.findFirst({
    where: eq(staffMeetings.id, meetingId),
    with: {
      createdByUser: {
        columns: { username: true, role: true },
      },
      attendanceRecords: {
        with: {
          user: {
            columns: { id: true, username: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!meeting) return null;

  // Retrieve all active staff to guarantee full roster coverage
  const allActiveStaff = await db.query.users.findMany({
    where: and(
      eq(users.isActive, true),
      inArray(users.role, [...STAFF_ROLES])
    ),
    columns: { id: true, username: true, email: true, role: true },
    orderBy: [asc(users.role), asc(users.username)],
  });

  const existingMap = new Map(
    meeting.attendanceRecords.map((att) => [att.userId, att])
  );

  const roster = allActiveStaff.map((staff) => {
    const record = existingMap.get(staff.id);
    return {
      userId: staff.id,
      username: staff.username,
      email: staff.email,
      role: staff.role,
      attended: record ? record.attended : true,
      remarks: record ? record.remarks : null,
    };
  });

  return {
    ...meeting,
    roster,
  };
}
