"use server";

import { db } from "@/lib/db";
import { remarksOptions } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addRemarkOption(formData: FormData) {
  await requireAdmin();
  
  const category = formData.get("category") as "sabaq" | "sabaq_juz" | "daura" | "attendance";
  const label = formData.get("label") as string;
  
  if (!category || !label || label.trim() === "") {
    return { error: "Category and Label are required" };
  }

  try {
    await db.insert(remarksOptions).values({
      category,
      label: label.trim(),
      isActive: true,
    });
    revalidatePath("/admin/settings/remarks");
    return { success: true };
  } catch (error) {
    console.error("Add Remark Error:", error);
    return { error: "Failed to add remark option" };
  }
}

export async function updateRemarkOption(id: string, label: string) {
  await requireAdmin();

  if (!label || label.trim() === "") {
    return { error: "Label is required" };
  }

  try {
    await db
      .update(remarksOptions)
      .set({ label: label.trim() })
      .where(eq(remarksOptions.id, id));
    revalidatePath("/admin/settings/remarks");
    return { success: true };
  } catch (error) {
    console.error("Update Remark Error:", error);
    return { error: "Failed to update remark option" };
  }
}

export async function deleteRemarkOption(id: string) {
  await requireAdmin();
  try {
    await db.delete(remarksOptions).where(eq(remarksOptions.id, id));
    revalidatePath("/admin/settings/remarks");
    return { success: true };
  } catch (error) {
    console.error("Delete Remark Error:", error);
    return { error: "Failed to delete remark. It might be in use." };
  }
}

export async function toggleRemarkStatus(id: string, isActive: boolean) {
  await requireAdmin();
  try {
    await db.update(remarksOptions)
      .set({ isActive })
      .where(eq(remarksOptions.id, id));
    revalidatePath("/admin/settings/remarks");
    return { success: true };
  } catch {
    return { error: "Failed to update remark status" };
  }
}
