import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";

/**
 * A "madrasa tutor" is a user with role "tutor" who is assigned to at least
 * one active Madrasa class and to no active Hifz class. Such tutors may only
 * use Madrasa features (madrasa attendance, exams, marks) and must not reach
 * Hifz, stars, parent/staff meetings or other areas.
 */
export async function isMadrasaOnlyTutor(userId: string): Promise<boolean> {
  const rows = await db
    .select({ track: classes.track })
    .from(classes)
    .where(and(eq(classes.tutorId, userId), eq(classes.isActive, true)));
  const hasMadrasa = rows.some((r) => r.track === "madrasa");
  const hasHifz = rows.some((r) => r.track === "hifz");
  return hasMadrasa && !hasHifz;
}

/** True when the session user is a tutor restricted to Madrasa features. */
export async function isMadrasaOnlySession(session: {
  user: { id: string; role?: string | null };
}): Promise<boolean> {
  return session.user.role === "tutor" && (await isMadrasaOnlyTutor(session.user.id));
}

/**
 * Like requireRole for tutor/admin/super_admin, but redirects madrasa-only
 * tutors to /unauthorized. Use on Hifz / stars / meetings pages and actions.
 */
export async function requireNonMadrasaTutor(
  roles: Parameters<typeof requireRole>[0] = ["tutor", "admin", "super_admin"]
) {
  const session = await requireRole(roles);
  if (await isMadrasaOnlySession(session)) redirect("/unauthorized");
  return session;
}
