"use server";

import { db } from "@/lib/db";
import { classes, enrollments, studentStars } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const awardStarSchema = z.object({
  studentId: z.string().uuid(),
  type: z.enum(["blue", "black"]),
  reason: z.string().trim().min(3, "Please provide a reason").max(500),
});

type StarManagerSession = Awaited<ReturnType<typeof requireRole>>;

function isAdmin(session: StarManagerSession) {
  return session.user.role === "admin" || session.user.role === "super_admin";
}

async function tutorCanManageStudent(userId: string, studentId: string) {
  const enrollment = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "active"),
        eq(classes.tutorId, userId),
        eq(classes.isActive, true)
      )
    )
    .limit(1);

  return enrollment.length > 0;
}

async function canManageStudent(
  session: StarManagerSession,
  studentId: string
) {
  return isAdmin(session)
    ? true
    : tutorCanManageStudent(session.user.id, studentId);
}

export async function awardStar(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = awardStarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { studentId, type, reason } = parsed.data;
  if (!(await canManageStudent(session, studentId))) {
    return {
      success: false,
      error: "You can only award stars to students in your assigned classes.",
    };
  }

  const [star] = await db
    .insert(studentStars)
    .values({ studentId, type, reason, awardedBy: session.user.id })
    .returning();

  await logActivity(
    session.user.id,
    `star.award_${type}`,
    "student_star",
    star.id,
    { studentId, reason }
  );

  revalidatePath("/tutor/stars");
  revalidatePath("/admin/students");
  revalidatePath("/parent/stars");
  revalidatePath("/student/stars");
  return { success: true, data: star };
}

export async function removeStar(starId: string) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsedId = z.string().uuid().safeParse(starId);
  if (!parsedId.success) {
    return { success: false, error: "Invalid star." };
  }

  const star = await db.query.studentStars.findFirst({
    where: eq(studentStars.id, parsedId.data),
  });
  if (!star) {
    return { success: false, error: "Star not found." };
  }
  if (!isAdmin(session) && star.awardedBy !== session.user.id) {
    return {
      success: false,
      error: "You can only remove stars that you awarded.",
    };
  }

  await db.delete(studentStars).where(eq(studentStars.id, parsedId.data));

  await logActivity(
    session.user.id,
    "star.remove",
    "student_star",
    parsedId.data,
    { studentId: star.studentId, type: star.type, reason: star.reason }
  );

  revalidatePath("/tutor/stars");
  revalidatePath("/admin/students");
  revalidatePath("/parent/stars");
  revalidatePath("/student/stars");
  return { success: true };
}

export async function getStudentStars(studentId: string) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsedId = z.string().uuid().safeParse(studentId);
  if (!parsedId.success || !(await canManageStudent(session, parsedId.data))) {
    return [];
  }

  return db.query.studentStars.findMany({
    where: eq(studentStars.studentId, parsedId.data),
    with: { awardedByUser: { columns: { username: true } } },
    orderBy: [desc(studentStars.awardedAt)],
  });
}

export async function getClassStarCounts(classId: string) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsedId = z.string().uuid().safeParse(classId);
  if (!parsedId.success) return [];

  if (!isAdmin(session)) {
    const assignedClass = await db.query.classes.findFirst({
      where: and(
        eq(classes.id, parsedId.data),
        eq(classes.tutorId, session.user.id),
        eq(classes.isActive, true)
      ),
      columns: { id: true },
    });
    if (!assignedClass) return [];
  }

  const classEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.classId, parsedId.data),
      eq(enrollments.status, "active")
    ),
  });

  const studentIds = classEnrollments.map((enrollment) => enrollment.studentId);
  if (studentIds.length === 0) return [];

  const stars = await db.query.studentStars.findMany({
    where: inArray(studentStars.studentId, studentIds),
    columns: { studentId: true, type: true },
  });

  return studentIds.map((id) => ({
    studentId: id,
    blueCount: stars.filter(
      (star) => star.studentId === id && star.type === "blue"
    ).length,
    blackCount: stars.filter(
      (star) => star.studentId === id && star.type === "black"
    ).length,
  }));
}
