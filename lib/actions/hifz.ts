"use server";

import { db } from "@/lib/db";
import { hifzDailyEntries, juzTracker } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const hifzEntrySchema = z.object({
  id: z.string().optional(),
  studentId: z.string().uuid(),
  date: z.string(),
  // Sabaq
  sabaqFromPage: z.string().nullable().optional(),
  sabaqToPage: z.string().nullable().optional(),
  sabaqPages: z.string().nullable().optional(),
  sabaqJuzNumber: z.number().nullable().optional(),
  sabaqRemarksId: z.string().nullable().optional(),
  // Sabaq Juz
  sabaqJuzGiven: z.boolean().default(false),
  sabaqJuzRemarksId: z.string().nullable().optional(),
  // Daura
  dauraJuzNumbers: z.array(z.number()).nullable().optional(),
  dauraRemarksId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Juz Tracking
  startJuzNumber: z.number().optional(),
  startJuzDate: z.string().optional(),
  completeJuzId: z.string().optional(),
  completeJuzDate: z.string().optional(),
});

export async function saveDailyHifzEntry(input: z.infer<typeof hifzEntrySchema>) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  
  const parsed = hifzEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid form data" };
  }
  
  const data = parsed.data;

  // Ensure an existing entry for this student and date doesn't conflict if we aren't updating it
  if (!data.id) {
    const existing = await db.query.hifzDailyEntries.findFirst({
      where: and(
        eq(hifzDailyEntries.studentId, data.studentId),
        eq(hifzDailyEntries.date, data.date)
      ),
    });
    if (existing) {
      data.id = existing.id;
    }
  }

  let entryId = data.id;

  if (data.id) {
    await db.update(hifzDailyEntries)
      .set({
        sabaqFromPage: data.sabaqFromPage ?? null,
        sabaqToPage: data.sabaqToPage ?? null,
        sabaqPages: data.sabaqPages ?? null,
        sabaqJuzNumber: data.sabaqJuzNumber ?? null,
        sabaqRemarksId: data.sabaqRemarksId ?? null,
        sabaqJuzGiven: data.sabaqJuzGiven,
        sabaqJuzRemarksId: data.sabaqJuzRemarksId ?? null,
        dauraJuzNumbers: data.dauraJuzNumbers ?? null,
        dauraRemarksId: data.dauraRemarksId ?? null,
        notes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(hifzDailyEntries.id, data.id));
  } else {
    const [inserted] = await db.insert(hifzDailyEntries).values({
      studentId: data.studentId,
      date: data.date,
      recordedBy: session.user.id,
      sabaqFromPage: data.sabaqFromPage ?? null,
      sabaqToPage: data.sabaqToPage ?? null,
      sabaqPages: data.sabaqPages ?? null,
      sabaqJuzNumber: data.sabaqJuzNumber ?? null,
      sabaqRemarksId: data.sabaqRemarksId ?? null,
      sabaqJuzGiven: data.sabaqJuzGiven,
      sabaqJuzRemarksId: data.sabaqJuzRemarksId ?? null,
      dauraJuzNumbers: data.dauraJuzNumbers ?? null,
      dauraRemarksId: data.dauraRemarksId ?? null,
      notes: data.notes ?? null,
    }).returning();
    entryId = inserted.id;
  }

  // Handle Juz Tracking Updates
  if (data.startJuzNumber && data.startJuzDate) {
    await db.insert(juzTracker)
      .values({
        studentId: data.studentId,
        juzNumber: data.startJuzNumber,
        startDate: data.startJuzDate,
        status: "in_progress",
        updatedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [juzTracker.studentId, juzTracker.juzNumber],
        set: {
          startDate: data.startJuzDate,
          status: "in_progress",
          completionDate: null,
          updatedBy: session.user.id,
          updatedAt: new Date(),
        },
      });
    await logActivity(session.user.id, "juz.start", "juz_tracker", data.studentId);
  } else if (data.completeJuzId && data.completeJuzDate) {
    await db.update(juzTracker)
      .set({
        status: "completed",
        completionDate: data.completeJuzDate,
        updatedAt: new Date(),
      })
      .where(eq(juzTracker.id, data.completeJuzId));
    await logActivity(session.user.id, "juz.complete", "juz_tracker", data.completeJuzId);
  }

  await logActivity(
    session.user.id,
    data.id ? "hifz_entry.update" : "hifz_entry.create",
    "hifz_daily_entries",
    entryId
  );

  revalidatePath("/tutor/hifz");
  revalidatePath(`/admin/students/${data.studentId}`);
  return { success: true };
}
