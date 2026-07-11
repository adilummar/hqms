"use server";

import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid credentials" };
  }

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch {
    return { success: false, error: "Invalid username or password" };
  }
}

export async function logoutAction() {
  // Dynamically build the redirect URL from the actual request host.
  // This works on any deployment (localhost, hqms-five.vercel.app, custom domain)
  // without relying on NEXTAUTH_URL being correct in the environment.
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  await signOut({ redirectTo: `${proto}://${host}/login` });
}


export async function resetPasswordAction(userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return { success: true };
}
