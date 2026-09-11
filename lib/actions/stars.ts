"use server";

import { db } from "@/lib/db";
import { classes, enrollments, studentStars } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

const awardStarSchema = z.object({
  studentId: z.string().uuid(),
  type: z.enum(["blue", "black"]),
  value: z.number().int().min(1).max(10),
  reason: z.string().trim().min(3, "Please provide a reason").max(500),
});

const updateStarSchema = z.object({
  starId: z.string().uuid(),
  type: z.enum(["blue", "black"]),
  value: z.number().int().min(1).max(10),
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

  const { studentId, type, value, reason } = parsed.data;
  if (!(await canManageStudent(session, studentId))) {
    return {
      success: false,
      error: "You can only award stars to students in your assigned classes.",
    };
  }

  const [star] = await db
    .insert(studentStars)
    .values({ studentId, type, value, reason, awardedBy: session.user.id })
    .returning();

  await logActivity(
    session.user.id,
    `star.award_${type}`,
    "student_star",
    star.id,
    { studentId, reason, value }
  );

  revalidatePath("/tutor/stars");
  revalidatePath("/admin/students");
  revalidatePath("/admin/stars");
  revalidatePath("/parent/stars");
  revalidatePath("/student/stars");
  return { success: true, data: star };
}

export async function updateStar(input: unknown) {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const parsed = updateStarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { starId, type, value, reason } = parsed.data;

  const star = await db.query.studentStars.findFirst({
    where: eq(studentStars.id, starId),
  });
  
  if (!star) {
    return { success: false, error: "Star not found." };
  }

  if (!isAdmin(session) && star.awardedBy !== session.user.id) {
    return {
      success: false,
      error: "You can only edit stars that you awarded.",
    };
  }

  const [updated] = await db
    .update(studentStars)
    .set({
      type,
      value,
      reason,
      updatedAt: new Date(),
    })
    .where(eq(studentStars.id, starId))
    .returning();

  await logActivity(
    session.user.id,
    "star.update",
    "student_star",
    starId,
    { studentId: star.studentId, type, value, reason }
  );

  revalidatePath("/tutor/stars");
  revalidatePath("/admin/students");
  revalidatePath("/admin/stars");
  revalidatePath("/parent/stars");
  revalidatePath("/student/stars");
  return { success: true, data: updated };
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

  await db
    .update(studentStars)
    .set({
      deletedAt: new Date(),
      deletedBy: session.user.id,
    })
    .where(eq(studentStars.id, parsedId.data));

  await logActivity(
    session.user.id,
    "star.remove",
    "student_star",
    parsedId.data,
    { studentId: star.studentId, type: star.type, reason: star.reason }
  );

  revalidatePath("/tutor/stars");
  revalidatePath("/admin/students");
  revalidatePath("/admin/stars");
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
    where: and(
      eq(studentStars.studentId, parsedId.data),
      isNull(studentStars.deletedAt)
    ),
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
    where: and(
      inArray(studentStars.studentId, studentIds),
      isNull(studentStars.deletedAt)
    ),
    columns: { studentId: true, type: true, value: true },
  });

  return studentIds.map((id) => ({
    studentId: id,
    blueCount: stars
      .filter((star) => star.studentId === id && star.type === "blue")
      .reduce((sum, star) => sum + star.value, 0),
    blackCount: stars
      .filter((star) => star.studentId === id && star.type === "black")
      .reduce((sum, star) => sum + star.value, 0),
  }));
}
