import NextAuth from "next-auth";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users, settings, students, parents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: Partial<Record<"username" | "password", unknown>>) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;

        // ── Path 1: Admission Number + Mobile login (for Parents) ──────────────
        // If the username looks like an admission number (numeric), try matching
        // a student by admissionNumber and verify password against parent's phone.
        const looksLikeAdmissionNumber = /^\d+$/.test(username.trim());
        if (looksLikeAdmissionNumber) {
          const student = await db.query.students.findFirst({
            where: eq(students.admissionNumber, username.trim()),
          });
          if (student) {
            const parent = await db.query.parents.findFirst({
              where: eq(parents.studentId, student.id),
              with: { user: true },
            });
            // Password must match primaryPhone (strip spaces/dashes for comparison)
            const normalize = (v: string) => v.replace(/[\s\-]/g, "");
            if (
              parent &&
              parent.user &&
              parent.user.isActive &&
              normalize(parent.primaryPhone) === normalize(password)
            ) {
              await db
                .update(users)
                .set({ lastLoginAt: new Date() })
                .where(eq(users.id, parent.user.id));
              return {
                id: parent.user.id,
                name: parent.user.username,
                email: parent.user.email ?? undefined,
                role: parent.user.role,
              };
            }
          }
        }

        // ── Path 2: Normal username + bcrypt password login ────────────────────
        const user = await db.query.users.findFirst({
          where: eq(users.username, username),
        });

        if (!user || !user.isActive) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Check student login toggle
        if (user.role === "student") {
          const studentLoginSetting = await db.query.settings.findFirst({
            where: eq(settings.key, "student_login_enabled"),
          });
          if (studentLoginSetting?.value !== "true") return null;
        }

        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          name: user.username,
          email: user.email ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
