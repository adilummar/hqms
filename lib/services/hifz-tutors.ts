import { db } from "@/lib/db";
import { users, classes } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * Staff meeting attendance covers only Hifz tutors: active users who are
 * assigned as tutor to at least one active class whose track is "hifz".
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
        eq(users.isActive, true)
      )
    )
    .orderBy(asc(users.username));
}
