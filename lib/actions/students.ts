"use server";

import { db } from "@/lib/db";
import { students, juzTracker, hifzDailyEntries, monthlyTargets } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import {
  updateStudentSchema,
  updateStudentStatusSchema,
} from "@/lib/validators/student.schema";
import {
  dailyEntrySchema,
  updateJuzEntrySchema,
  setMonthlyTargetSchema,
} from "@/lib/validators/hifz.schema";
import { eq, and, between, count, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// === STUDENT ACTIONS ===

export async function updateStudentInfo(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = updateStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { id, ...updateData } = parsed.data;
  const [updated] = await db
    .update(students)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning();

  await logActivity(session.user.id, "student.update", "student", id);
  revalidatePath(`/admin/students/${id}`);
  return { success: true, data: updated };
}

export async function updateStudentStatus(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = updateStudentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const [updated] = await db
    .update(students)
    .set({
      status: parsed.data.status,
      completionDate: parsed.data.completionDate ?? null,
      discontinuationDate: parsed.data.discontinuationDate ?? null,
      discontinuationReason: parsed.data.discontinuationReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(students.id, parsed.data.id))
    .returning();

  await logActivity(
    session.user.id,
    `student.status.${parsed.data.status}`,
    "student",
    parsed.data.id
  );
  revalidatePath(`/admin/students/${parsed.data.id}`);
  revalidatePath("/admin/students");
  return { success: true, data: updated };
}

// === HIFZ ACTIONS ===

export async function createOrUpdateDailyEntry(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = dailyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  const sabaqPages =
    d.sabaqFromPage !== undefined && d.sabaqToPage !== undefined
      ? String(d.sabaqToPage - d.sabaqFromPage)
      : null;

  const [entry] = await db
    .insert(hifzDailyEntries)
    .values({
      studentId: d.studentId,
      date: d.date,
      sabaqFromPage: d.sabaqFromPage !== undefined ? String(d.sabaqFromPage) : null,
      sabaqToPage: d.sabaqToPage !== undefined ? String(d.sabaqToPage) : null,
      sabaqPages,
      sabaqRemarksId: d.sabaqRemarksId ?? null,
      sabaqJuzGiven: d.sabaqJuzGiven,
      sabaqJuzRemarksId: d.sabaqJuzRemarksId ?? null,
      dauraJuzNumbers: d.dauraJuzNumbers ?? null,
      dauraRemarksId: d.dauraRemarksId ?? null,
      recordedBy: session.user.id,
      notes: d.notes,
    })
    .onConflictDoUpdate({
      target: [hifzDailyEntries.studentId, hifzDailyEntries.date],
      set: {
        sabaqFromPage: d.sabaqFromPage !== undefined ? String(d.sabaqFromPage) : null,
        sabaqToPage: d.sabaqToPage !== undefined ? String(d.sabaqToPage) : null,
        sabaqPages,
        sabaqRemarksId: d.sabaqRemarksId ?? null,
        sabaqJuzGiven: d.sabaqJuzGiven,
        sabaqJuzRemarksId: d.sabaqJuzRemarksId ?? null,
        dauraJuzNumbers: d.dauraJuzNumbers ?? null,
        dauraRemarksId: d.dauraRemarksId ?? null,
        recordedBy: session.user.id,
        notes: d.notes,
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity(
    session.user.id,
    "hifz.daily_entry",
    "hifz_daily_entry",
    entry.id
  );

  revalidatePath("/tutor/hifz");
  revalidatePath("/admin/hifz");
  return { success: true, data: entry };
}

export async function updateJuzEntry(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = updateJuzEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  let status: "not_started" | "in_progress" | "completed" = "not_started";
  if (d.startDate && d.completionDate) status = "completed";
  else if (d.startDate) status = "in_progress";

  const [entry] = await db
    .insert(juzTracker)
    .values({
      studentId: d.studentId,
      juzNumber: d.juzNumber,
      startDate: d.startDate ?? null,
      completionDate: d.completionDate ?? null,
      status,
      notes: d.notes,
      updatedBy: session.user.id,
    })
    .onConflictDoUpdate({
      target: [juzTracker.studentId, juzTracker.juzNumber],
      set: {
        startDate: d.startDate ?? null,
        completionDate: d.completionDate ?? null,
        status,
        notes: d.notes,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity(
    session.user.id,
    "hifz.juz_update",
    "juz_tracker",
    entry.id
  );

  revalidatePath(`/admin/students/${d.studentId}`);
  return { success: true, data: entry };
}

export async function setMonthlyTarget(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = setMonthlyTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  const [target] = await db
    .insert(monthlyTargets)
    .values({
      studentId: d.studentId,
      year: d.year,
      month: d.month,
      targetJuz: String(d.targetJuz),
      setBy: session.user.id,
      notes: d.notes,
    })
    .onConflictDoUpdate({
      target: [monthlyTargets.studentId, monthlyTargets.year, monthlyTargets.month],
      set: {
        targetJuz: String(d.targetJuz),
        setBy: session.user.id,
        notes: d.notes,
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity(
    session.user.id,
    "hifz.target_set",
    "monthly_target",
    target.id
  );

  revalidatePath("/admin/hifz/targets");
  revalidatePath("/tutor/hifz/targets");
  return { success: true, data: target };
}

export async function getToppers(classId: string, year: number, month: number) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const toppers = await db
    .select({
      studentId: students.id,
      studentCode: students.studentCode,
      firstName: students.firstName,
      lastName: students.lastName,
      actualJuz: count(juzTracker.id),
    })
    .from(students)
    .leftJoin(
      juzTracker,
      and(
        eq(juzTracker.studentId, students.id),
        between(juzTracker.completionDate!, monthStart, monthEnd)
      )
    )
    .where(eq(students.status, "active"))
    .groupBy(students.id)
    .orderBy(desc(count(juzTracker.id)));

  return { success: true, data: toppers };
}
