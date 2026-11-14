"use server";

import { db } from "@/lib/db";
import {
  staffMeetings,
  staffMeetingAttendance,
  staffMeetingExternalParticipants,
} from "@/lib/db/schema";
import { getHifzTutors } from "@/lib/services/hifz-tutors";
import { requireAdmin, requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  categoryFields,
  validateCustomCategory,
  normalizeCategory,
  participantsSchema,
  findDuplicateExternal,
  type MeetingAttendee,
  type ExternalParticipant,
} from "@/lib/staff-meetings/participants";

const baseFields = {
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(150),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  meetingTime: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
};

const createStaffMeetingSchema = z
  .object({ ...baseFields, ...categoryFields, ...participantsSchema.shape })
  .superRefine((v, ctx) => {
    validateCustomCategory(v, ctx);
    if (v.participantUserIds.length + v.externalParticipants.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["participantUserIds"],
        message: "Select at least one participant",
      });
    }
  });

const updateMinutesSchema = z.object({
  meetingId: z.string().uuid(),
  minutes: z.string().trim().optional().nullable(),
  decisions: z.string().trim().optional().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
});

// Category and participants are optional on update: omitting them leaves them untouched.
const updateStaffMeetingDetailsSchema = z
  .object({
    meetingId: z.string().uuid(),
    ...baseFields,
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
    category: categoryFields.category.optional(),
    customCategory: categoryFields.customCategory,
    participantUserIds: participantsSchema.shape.participantUserIds.optional(),
    externalParticipants: participantsSchema.shape.externalParticipants.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.category) validateCustomCategory({ ...v, category: v.category }, ctx);
    if ((v.participantUserIds === undefined) !== (v.externalParticipants === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["participantUserIds"],
        message: "Provide both registered and external participants",
      });
    }
    if (
      v.participantUserIds &&
      v.externalParticipants &&
      v.participantUserIds.length + v.externalParticipants.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["participantUserIds"],
        message: "Select at least one participant",
      });
    }
  });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class ParticipantError extends Error {}

/**
 * Applies the participant selection for one meeting. Registered staff are stored
 * as staffMeetingAttendance rows (existing attendance of retained staff is kept);
 * external guests in their own table. Nothing outside this meeting is touched.
 * Returns an error message, or null on success.
 */
async function syncParticipants(
  tx: Tx,
  meetingId: string,
  recordedBy: string,
  userIds: string[],
  externals: ExternalParticipant[]
): Promise<string | null> {
  const dup = findDuplicateExternal(externals);
  if (dup) return `External participant "${dup}" is added more than once`;

  const wanted = [...new Set(userIds)];

  // Only currently eligible staff, or people already on this meeting, may be added.
  const eligible = new Set((await getHifzTutors()).map((t) => t.id));
  const existingRows = await tx
    .select({ userId: staffMeetingAttendance.userId })
    .from(staffMeetingAttendance)
    .where(eq(staffMeetingAttendance.meetingId, meetingId));
  const existingIds = new Set(existingRows.map((r) => r.userId));
  const invalid = wanted.filter((id) => !eligible.has(id) && !existingIds.has(id));
  if (invalid.length > 0) return "One or more selected staff members are not eligible";

  const toRemove = [...existingIds].filter((id) => !wanted.includes(id));
  if (toRemove.length > 0) {
    await tx
      .delete(staffMeetingAttendance)
      .where(
        and(
          eq(staffMeetingAttendance.meetingId, meetingId),
          inArray(staffMeetingAttendance.userId, toRemove)
        )
      );
  }
  const toAdd = wanted.filter((id) => !existingIds.has(id));
  if (toAdd.length > 0) {
    await tx
      .insert(staffMeetingAttendance)
      .values(
        toAdd.map((userId) => ({
          meetingId,
          userId,
          attended: true,
          recordedBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .onConflictDoNothing();
  }

  // External guests: update kept ones (attendance untouched), insert new, delete dropped.
  const savedExt = await tx
    .select({ id: staffMeetingExternalParticipants.id })
    .from(staffMeetingExternalParticipants)
    .where(eq(staffMeetingExternalParticipants.meetingId, meetingId));
  const savedIds = new Set(savedExt.map((e) => e.id));
  const keptIds = new Set(externals.filter((e) => e.id && savedIds.has(e.id)).map((e) => e.id!));
  const dropped = [...savedIds].filter((id) => !keptIds.has(id));
  if (dropped.length > 0) {
    await tx
      .delete(staffMeetingExternalParticipants)
      .where(
        and(
          eq(staffMeetingExternalParticipants.meetingId, meetingId),
          inArray(staffMeetingExternalParticipants.id, dropped)
        )
      );
  }
  for (const e of externals) {
    if (e.id && keptIds.has(e.id)) {
      await tx
        .update(staffMeetingExternalParticipants)
        .set({
          name: e.name,
          designation: e.designation,
          contactNumber: e.contactNumber,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(staffMeetingExternalParticipants.id, e.id),
            eq(staffMeetingExternalParticipants.meetingId, meetingId)
          )
        );
    } else {
      await tx.insert(staffMeetingExternalParticipants).values({
        meetingId,
        name: e.name,
        designation: e.designation,
        contactNumber: e.contactNumber,
      });
    }
  }
  return null;
}

/** Create a new staff meeting */
export async function createStaffMeeting(input: unknown) {
  const session = await requireAdmin();
  const parsed = createStaffMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { title, meetingDate, meetingTime, location, description } = parsed.data;
  const cat = normalizeCategory(parsed.data);

  let meeting;
  try {
    meeting = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(staffMeetings)
        .values({
          title,
          meetingDate,
          meetingTime: meetingTime || null,
          location: location || null,
          description: description || null,
          category: cat.category,
          customCategory: cat.customCategory,
          participantsExplicit: true,
          status: "scheduled",
          createdBy: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const err = await syncParticipants(
        tx,
        m.id,
        session.user.id,
        parsed.data.participantUserIds,
        parsed.data.externalParticipants
      );
      if (err) throw new ParticipantError(err);
      return m;
    });
  } catch (e) {
    if (e instanceof ParticipantError) {
      return { success: false, error: { participantUserIds: [e.message] } };
    }
    throw e;
  }

  await logActivity(session.user.id, "staff_meeting.create", "staff_meeting", meeting.id, {
    title,
    meetingDate,
    category: cat.category,
    staffCount: new Set(parsed.data.participantUserIds).size,
    externalCount: parsed.data.externalParticipants.length,
  });

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

/**
 * Update meeting basic details. Optionally also category and the participant list.
 * Editing never resets attendance: staff that stay on the list keep their records.
 */
export async function updateStaffMeetingDetails(input: unknown) {
  const session = await requireAdmin();
  const parsed = updateStaffMeetingDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { meetingId, title, meetingDate, meetingTime, location, description, status } = parsed.data;

  const existing = await db.query.staffMeetings.findFirst({
    where: eq(staffMeetings.id, meetingId),
    columns: { id: true },
  });
  if (!existing) return { success: false, error: { meetingId: ["Meeting not found"] } };

  const cat = parsed.data.category ? normalizeCategory({ ...parsed.data, category: parsed.data.category }) : null;
  const participantsProvided =
    parsed.data.participantUserIds !== undefined && parsed.data.externalParticipants !== undefined;

  let updated;
  try {
    updated = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(staffMeetings)
        .set({
          title,
          meetingDate,
          meetingTime: meetingTime || null,
          location: location || null,
          description: description || null,
          status: status || undefined,
          ...(cat ? { category: cat.category, customCategory: cat.customCategory } : {}),
          ...(participantsProvided ? { participantsExplicit: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(staffMeetings.id, meetingId))
        .returning();
      if (participantsProvided) {
        const err = await syncParticipants(
          tx,
          meetingId,
          session.user.id,
          parsed.data.participantUserIds!,
          parsed.data.externalParticipants!
        );
        if (err) throw new ParticipantError(err);
      }
      return u;
    });
  } catch (e) {
    if (e instanceof ParticipantError) {
      return { success: false, error: { participantUserIds: [e.message] } };
    }
    throw e;
  }

  await logActivity(
    session.user.id,
    "staff_meeting.update_details",
    "staff_meeting",
    meetingId,
    { title, meetingDate, status: updated.status, participantsUpdated: participantsProvided }
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

/** Save attendance for a meeting: registered staff by userId, external guests by id. */
export async function saveStaffMeetingAttendance(
  meetingId: string,
  entries: { userId: string; attended: boolean; remarks?: string }[],
  externalEntries: { id: string; attended: boolean; remarks?: string }[] = []
) {
  const session = await requireAdmin();

  const meeting = await db.query.staffMeetings.findFirst({
    where: eq(staffMeetings.id, meetingId),
    columns: { id: true, participantsExplicit: true },
  });
  if (!meeting) return { success: false, error: "Meeting not found" };

  // For meetings with an explicit participant list, only those participants can be recorded.
  let allowedUserIds: Set<string> | null = null;
  if (meeting.participantsExplicit) {
    const rows = await db
      .select({ userId: staffMeetingAttendance.userId })
      .from(staffMeetingAttendance)
      .where(eq(staffMeetingAttendance.meetingId, meetingId));
    allowedUserIds = new Set(rows.map((r) => r.userId));
  }

  for (const entry of entries) {
    if (allowedUserIds && !allowedUserIds.has(entry.userId)) continue;

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

  for (const entry of externalEntries) {
    await db
      .update(staffMeetingExternalParticipants)
      .set({
        attended: entry.attended,
        remarks: entry.remarks ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(staffMeetingExternalParticipants.id, entry.id),
          eq(staffMeetingExternalParticipants.meetingId, meetingId)
        )
      );
  }

  await logActivity(
    session.user.id,
    "staff_meeting.attendance_update",
    "staff_meeting",
    meetingId,
    { count: entries.length, externalCount: externalEntries.length }
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
      externalParticipants: true,
    },
  });

  if (!meeting) return null;

  let staffRoster: MeetingAttendee[];
  if (meeting.participantsExplicit) {
    // Explicit list: exactly the staff chosen for this meeting (even if no longer eligible today).
    staffRoster = meeting.attendanceRecords
      .map((rec) => ({
        key: rec.userId,
        kind: "staff" as const,
        userId: rec.userId,
        externalId: null,
        username: rec.user.username,
        email: rec.user.email,
        role: rec.user.role,
        attended: rec.attended,
        remarks: rec.remarks,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  } else {
    // Legacy meeting: Hifz tutors only (tutors assigned to active hifz-track classes)
    const allActiveStaff = await getHifzTutors();
    const existingMap = new Map(meeting.attendanceRecords.map((att) => [att.userId, att]));
    staffRoster = allActiveStaff.map((staff) => {
      const record = existingMap.get(staff.id);
      return {
        key: staff.id,
        kind: "staff" as const,
        userId: staff.id,
        externalId: null,
        username: staff.username,
        email: staff.email,
        role: staff.role,
        attended: record ? record.attended : true,
        remarks: record ? record.remarks : null,
      };
    });
  }

  const externalRoster: MeetingAttendee[] = [...meeting.externalParticipants]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((ext) => ({
      key: `ext:${ext.id}`,
      kind: "external" as const,
      userId: null,
      externalId: ext.id,
      username: ext.name,
      email: null,
      role: "external",
      designation: ext.designation,
      contactNumber: ext.contactNumber,
      attended: ext.attended,
      remarks: ext.remarks,
    }));

  // Picker data for editing. Candidates = currently eligible staff plus anyone who already has a
  // record on this meeting, so historical participants are never silently dropped.
  const candidateMap = new Map<string, { id: string; username: string; email: string | null; role: string }>();
  for (const t of await getHifzTutors()) {
    candidateMap.set(t.id, { id: t.id, username: t.username, email: t.email, role: t.role });
  }
  for (const rec of meeting.attendanceRecords) {
    candidateMap.set(rec.userId, {
      id: rec.userId,
      username: rec.user.username,
      email: rec.user.email,
      role: rec.user.role,
    });
  }
  const selectedUserIds = [
    ...new Set([
      ...staffRoster.map((r) => r.userId!),
      ...meeting.attendanceRecords.map((r) => r.userId),
    ]),
  ];

  return {
    ...meeting,
    roster: [...staffRoster, ...externalRoster],
    candidates: [...candidateMap.values()].sort((a, b) => a.username.localeCompare(b.username)),
    selectedUserIds,
  };
}

/** Eligible staff for the participant picker (existing eligibility rules, unchanged). */
export async function getEligibleMeetingStaff() {
  await requireAdmin();
  return getHifzTutors();
}
