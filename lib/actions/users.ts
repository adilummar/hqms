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
