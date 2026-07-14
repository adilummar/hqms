"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "admin", "tutor", "parent"]),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  // Check if username already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, data.username),
  });

  if (existingUser) {
    return { success: false, error: "Username already taken" };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const [newUser] = await db.insert(users).values({
    username: data.username,
    email: data.email || null,
    passwordHash,
    role: data.role,
    isActive: true,
  }).returning();

  await logActivity(session.user.id, "user.create", "users", newUser.id);

  revalidatePath("/admin/settings/users");
  
  return { success: true };
}

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function changeOwnPassword(input: z.infer<typeof changeOwnPasswordSchema>) {
  const session = await requireRole(["super_admin", "admin", "tutor", "parent", "student"]);

  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const userId = session.user.id as string;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return { success: false, error: "User not found" };

  const passwordMatch = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!passwordMatch) return { success: false, error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  await logActivity(userId, "user.change_own_password", "users", userId);

  return { success: true };
}

const adminResetPasswordSchema = z.object({
  targetUserId: z.string().uuid(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function adminResetUserPassword(input: z.infer<typeof adminResetPasswordSchema>) {
  const session = await requireRole(["super_admin", "admin"]);

  const parsed = adminResetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { targetUserId, newPassword } = parsed.data;

  const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  if (!targetUser) return { success: false, error: "User not found" };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, targetUserId));

  await logActivity(session.user.id as string, "user.reset_password", "users", targetUserId);

  revalidatePath("/admin/settings/users");
  return { success: true };
}

// ── Disable / Enable ──────────────────────────────────────────────────────────

export async function toggleUserStatus(targetUserId: string, makeActive: boolean) {
  const session = await requireRole(["super_admin", "admin"]);

  if (session.user.id === targetUserId) {
    return { success: false, error: "You cannot change your own account status." };
  }

  const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  if (!targetUser) return { success: false, error: "User not found." };

  // Regular admins cannot touch super_admins
  if (targetUser.role === "super_admin" && session.user.role !== "super_admin") {
    return { success: false, error: "Only super admins can modify super admin accounts." };
  }

  await db
    .update(users)
    .set({ isActive: makeActive, updatedAt: new Date() })
    .where(eq(users.id, targetUserId));

  await logActivity(
    session.user.id as string,
    makeActive ? "user.enable" : "user.disable",
    "users",
    targetUserId
  );

  revalidatePath("/admin/settings/users");
  return { success: true };
}

// ── Delete ────────────────────────────────────────────────────────────────────
// activityLogs.userId is NOT NULL + onDelete:restrict, so we check for logs
// first and return a friendly error rather than letting the DB reject it.

export async function deleteUser(targetUserId: string) {
  const session = await requireRole(["super_admin", "admin"]);

  if (session.user.id === targetUserId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  if (!targetUser) return { success: false, error: "User not found." };

  if (targetUser.role === "super_admin" && session.user.role !== "super_admin") {
    return { success: false, error: "Only super admins can delete super admin accounts." };
  }

  // Check for activity logs (FK restrict prevents deletion if any exist)
  const { activityLogs } = await import("@/lib/db/schema");
  const { count } = await import("drizzle-orm");
  const [{ total }] = await db
    .select({ total: count() })
    .from(activityLogs)
    .where(eq(activityLogs.userId, targetUserId));

  if (Number(total) > 0) {
    return {
      success: false,
      error: `Cannot delete — this user has ${total} activity log${Number(total) !== 1 ? "s" : ""}. Disable the account instead.`,
    };
  }

  await db.delete(users).where(eq(users.id, targetUserId));

  await logActivity(session.user.id as string, "user.delete", "users", targetUserId);

  revalidatePath("/admin/settings/users");
  return { success: true };
}

