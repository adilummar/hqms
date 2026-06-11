"use server";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function toggleStudentLogin(currentValue: boolean) {
  await requireRole(["super_admin", "admin"]);

  const newValue = !currentValue;

  // Try to update the existing row first
  const updated = await db
    .update(settings)
    .set({ value: String(newValue), updatedAt: new Date() })
    .where(eq(settings.key, "student_login_enabled"))
    .returning();

  // If no row existed yet, insert it
  if (updated.length === 0) {
    await db.insert(settings).values({
      key: "student_login_enabled",
      value: String(newValue),
      description: "Controls whether students can log into the portal",
    });
  }

  revalidatePath("/admin/settings");
  return { success: true, enabled: newValue };
}

export async function updateSetting(key: string, value: string) {
  await requireRole(["super_admin", "admin"]);

  const updated = await db
    .update(settings)
    .set({ value, updatedAt: new Date() })
    .where(eq(settings.key, key))
    .returning();

  if (updated.length === 0) {
    await db.insert(settings).values({ key, value });
  }

  revalidatePath("/admin/settings");
  return { success: true };
}
