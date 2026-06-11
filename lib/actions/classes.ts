"use server";

import { db } from "@/lib/db";
import { classes, academicYears } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const assignTutorSchema = z.object({
  classId: z.string().uuid(),
  tutorId: z.string().uuid().nullable(),
});

export async function assignTutorToClass(input: z.infer<typeof assignTutorSchema>) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = assignTutorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const data = parsed.data;

  await db.update(classes)
    .set({
      tutorId: data.tutorId,
      updatedAt: new Date(),
    })
    .where(eq(classes.id, data.classId));

  await logActivity(session.user.id, "class.assign_tutor", "classes", data.classId);

  revalidatePath("/admin/settings/classes");
  
  return { success: true };
}

const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(20),
  track: z.enum(["hifz", "madrasa", "school"]),
  capacity: z.coerce.number().min(1).default(30),
  tutorId: z.string().uuid().nullable().optional(),
});

export async function createClass(input: z.infer<typeof createClassSchema>) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  // Get active academic year
  const currentYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isCurrent, true),
  });

  if (!currentYear) {
    return { success: false, error: "No active academic year found. Please configure settings." };
  }

  const [newClass] = await db.insert(classes).values({
    name: data.name,
    track: data.track,
    capacity: data.capacity,
    tutorId: data.tutorId ?? null,
    academicYearId: currentYear.id,
    isActive: true,
  }).returning();

  await logActivity(session.user.id, "class.create", "classes", newClass.id);

  revalidatePath("/admin/settings/classes");
  
  return { success: true };
}

const updateClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Class name is required").max(20),
  track: z.enum(["hifz", "madrasa", "school"]),
  capacity: z.coerce.number().min(1).default(30),
  tutorId: z.string().uuid().nullable().optional(),
  isActive: z.boolean(),
});

export async function updateClass(input: z.infer<typeof updateClassSchema>) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = updateClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  await db.update(classes)
    .set({
      name: data.name,
      track: data.track,
      capacity: data.capacity,
      tutorId: data.tutorId ?? null,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(classes.id, data.id));

  await logActivity(session.user.id, "class.update", "classes", data.id);

  revalidatePath("/admin/settings/classes");
  
  return { success: true };
}
