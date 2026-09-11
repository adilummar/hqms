"use server";

import { db } from "@/lib/db";
import { examinations, examSessions } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

const createExaminationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  academicYearId: z.string().uuid("Invalid academic year"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tracks: z.array(z.enum(["school", "madrasa", "hifz"])).min(1, "Select at least one track"),
  tutorMarkEntryOnly: z.boolean().optional(),
  sessionDates: z.record(
    z.string(),
    z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  ).optional(),
});

export async function createExamination(data: z.infer<typeof createExaminationSchema>) {
  const session = await requireAdmin();
  
  const parsed = createExaminationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  
  const { name, academicYearId, startDate, endDate, tracks, tutorMarkEntryOnly, sessionDates } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      // 1. Create the parent examination
      const [exam] = await tx.insert(examinations).values({
        name,
        academicYearId,
        startDate: startDate || null,
        endDate: endDate || null,
        createdBy: session.user.id,
      }).returning();

      // 2. Create the selected tracks as exam_sessions
      if (tracks.length > 0) {
        await tx.insert(examSessions).values(
          tracks.map(track => {
            const trackDates = sessionDates?.[track];
            return {
              examinationId: exam.id,
              name: `${name} - ${track.charAt(0).toUpperCase() + track.slice(1)}`,
              track,
              academicYearId,
              startDate: trackDates?.startDate || null,
              endDate: trackDates?.endDate || null,
              createdBy: session.user.id,
              tutorMarkEntryOnly: tutorMarkEntryOnly ?? false,
            };
          })
        );
      }

      return { success: true, id: exam.id };
    });
  } catch (error) {
    console.error("Failed to create examination:", error);
    return { success: false, error: "Failed to create examination" };
  }
}

export async function deleteExamination(id: string) {
  await requireAdmin();
  try {
    await db.delete(examinations).where(eq(examinations.id, id));
    return { success: true };
  } catch (error) {
    console.error("Failed to delete examination:", error);
    return { success: false, error: "Failed to delete examination" };
  }
}
