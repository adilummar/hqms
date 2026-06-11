"use server";

import { db } from "@/lib/db";
import { inventoryCategories, inventoryItems } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

const REVALIDATE = () => revalidatePath("/admin/inventory");

// ── Category schemas ──────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().max(10).optional(),
});

// ── Item schemas ──────────────────────────────────────────────────────────────

const itemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0),
  unit: z.string().max(30).optional(),
  minStockAlert: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const updateItemSchema = itemSchema.partial().extend({
  id: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).optional(),
});

// ── Categories ────────────────────────────────────────────────────────────────

export async function createCategory(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const [cat] = await db.insert(inventoryCategories).values({
    ...parsed.data,
    createdBy: session.user.id,
  }).returning();

  await logActivity(session.user.id, "inventory.category_create", "inventory_category", cat.id, { name: cat.name });
  REVALIDATE();
  return { success: true, data: cat };
}

export async function updateCategory(id: string, input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = categorySchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const [cat] = await db.update(inventoryCategories)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(inventoryCategories.id, id))
    .returning();

  await logActivity(session.user.id, "inventory.category_update", "inventory_category", id);
  REVALIDATE();
  return { success: true, data: cat };
}

export async function deleteCategory(id: string) {
  const session = await requireRole(["admin", "super_admin"]);
  await db.delete(inventoryCategories).where(eq(inventoryCategories.id, id));
  await logActivity(session.user.id, "inventory.category_delete", "inventory_category", id);
  REVALIDATE();
  return { success: true };
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function createItem(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const [item] = await db.insert(inventoryItems).values({
    ...parsed.data,
    lastUpdatedBy: session.user.id,
  }).returning();

  await logActivity(session.user.id, "inventory.item_create", "inventory_item", item.id, { name: item.name });
  REVALIDATE();
  return { success: true, data: item };
}

export async function updateItem(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.flatten().fieldErrors };

  const { id, ...rest } = parsed.data;
  const [item] = await db.update(inventoryItems)
    .set({ ...rest, lastUpdatedBy: session.user.id, updatedAt: new Date() })
    .where(eq(inventoryItems.id, id))
    .returning();

  await logActivity(session.user.id, "inventory.item_update", "inventory_item", id);
  REVALIDATE();
  return { success: true, data: item };
}

export async function deleteItem(id: string) {
  const session = await requireRole(["admin", "super_admin"]);
  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  await logActivity(session.user.id, "inventory.item_delete", "inventory_item", id);
  REVALIDATE();
  return { success: true };
}

// ── Quick quantity adjust (+ / -) ─────────────────────────────────────────────

export async function adjustQuantity(id: string, delta: number) {
  const session = await requireRole(["admin", "super_admin"]);
  const current = await db.query.inventoryItems.findFirst({ where: eq(inventoryItems.id, id) });
  if (!current) return { success: false, error: "Item not found" };

  const newQty = Math.max(0, current.quantity + delta);
  const [item] = await db.update(inventoryItems)
    .set({ quantity: newQty, lastUpdatedBy: session.user.id, updatedAt: new Date() })
    .where(eq(inventoryItems.id, id))
    .returning();

  REVALIDATE();
  return { success: true, data: item };
}
