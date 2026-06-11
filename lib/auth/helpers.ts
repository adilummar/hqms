import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parents, students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type UserRole =
  | "super_admin"
  | "admin"
  | "tutor"
  | "school_admin"
  | "parent"
  | "student";

export async function getSession() {
  return await auth();
}

export async function requireRole(roles: UserRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roles.includes(session.user.role as UserRole)) redirect("/unauthorized");
  return session;
}

export async function requireAdmin() {
  return requireRole(["admin", "super_admin"]);
}

export async function requireTutor() {
  return requireRole(["tutor", "admin", "super_admin"]);
}

export async function requireParent() {
  return requireRole(["parent"]);
}

export async function requireSchoolAdmin() {
  return requireRole(["school_admin", "super_admin"]);
}

export async function requireStudent() {
  return requireRole(["student"]);
}

/** Get the student ID linked to the current parent session */
export async function getParentStudentId(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parent = await db.query.parents.findFirst({
    where: eq(parents.userId, session.user.id as string),
  });

  if (!parent) redirect("/login");
  return parent.studentId;
}

/** Get the student ID linked to the current student session */
export async function getStudentProfileId(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const student = await db.query.students.findFirst({
    where: eq(students.userId, session.user.id as string),
  });

  if (!student) redirect("/login");
  return student.id;
}
