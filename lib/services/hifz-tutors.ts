import { db } from "@/lib/db";
import { users, classes } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * Eligible Hifz tutors: active users with role "tutor" who are assigned as
 * tutor to at least one active class whose track is "hifz". A tutor with
 * several Hifz classes appears once.
 *
 * Single source of truth for staff meeting attendance and staff (FN/AN)
 * attendance, including daily/monthly views, reports and automatic absence.
 */
export async function getHifzTutors() {
  return db
    .selectDistinct({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
    })
    .from(classes)
    .innerJoin(users, eq(classes.tutorId, users.id))
    .where(
      and(
        eq(classes.track, "hifz"),
        eq(classes.isActive, true),
        eq(users.isActive, true),
        eq(users.role, "tutor")
      )
    )
    .orderBy(asc(users.username));
}

/** Whether a given user is currently an eligible Hifz tutor. */
export async function isHifzTutor(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(classes)
    .innerJoin(users, eq(classes.tutorId, users.id))
    .where(
      and(
        eq(classes.track, "hifz"),
        eq(classes.isActive, true),
        eq(users.isActive, true),
        eq(users.role, "tutor"),
        eq(users.id, userId)
      )
    )
    .limit(1);
  return rows.length > 0;
}
