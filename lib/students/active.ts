/**
 * Shared "operational student" eligibility helpers.
 *
 * HQMS has two independent status fields:
 *   - students.status          : "active" | "completed" | "discontinued"
 *   - enrollments.status       : "active" | "completed" | "withdrawn"  (per class + academic year)
 *
 * Changing a student's status (updateStudentStatus) only updates students.status;
 * it does NOT touch their enrollments. So an enrollment can stay "active" while the
 * student is discontinued/completed. A student is OPERATIONALLY active (eligible for new
 * daily entries, attendance, mark entry, stars, leave, parent meetings...) only when BOTH
 *   students.status = "active"  AND  enrollments.status = "active" (in the class in question).
 *
 * Historical views (past attendance, Hifz entries, exam marks, published results, progress
 * cards, reports) must NOT use these helpers: records stay reachable for students who are
 * inactive now. Module-specific rules (class authorization, track, Hafiz mode, ...) stay in
 * their own modules; these helpers only answer "is the student active?".
 */
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments, students } from "@/lib/db/schema";

export type StudentStatus = "active" | "completed" | "discontinued";
export type EnrollmentStatus = "active" | "completed" | "withdrawn";

/** Pure rule: operational only when the student record AND the enrollment are active. */
export function isOperationalStudent(
  studentStatus: StudentStatus | string | null | undefined,
  enrollmentStatus: EnrollmentStatus | string | null | undefined
): boolean {
  return studentStatus === "active" && enrollmentStatus === "active";
}

/** Pure rule for places that only have the student record (no class context). */
export function isActiveStudentStatus(status: string | null | undefined): boolean {
  return status === "active";
}

/** Subquery of ids of students whose own status is "active". */
export function activeStudentIdsSubquery() {
  return db.select({ id: students.id }).from(students).where(eq(students.status, "active"));
}

/**
 * SQL condition for queries on `enrollments`: the enrollment's student must be active.
 * Combine with the class / year / enrollment status filters, e.g.
 *   where: and(eq(enrollments.classId, id), eq(enrollments.status, "active"), enrollmentStudentIsActive())
 */
export function enrollmentStudentIsActive(): SQL {
  return inArray(enrollments.studentId, activeStudentIdsSubquery());
}

/** Active enrollments of ACTIVE students in a class (optionally a given academic year). */
export function activeClassEnrollmentWhere(classId: string, academicYearId?: string): SQL {
  const conds: SQL[] = [
    eq(enrollments.classId, classId),
    eq(enrollments.status, "active"),
    enrollmentStudentIsActive(),
  ];
  if (academicYearId) conds.push(eq(enrollments.academicYearId, academicYearId));
  return and(...conds) as SQL;
}

/** Ids (from `ids`) whose student record is active. */
export async function filterActiveStudentIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(and(inArray(students.id, ids), eq(students.status, "active")));
  return rows.map((r) => r.id);
}

/**
 * Server-side guard for NEW operational records. Returns the ids that are NOT active
 * (empty array means all are fine). Missing ids are reported as inactive too.
 */
export async function findInactiveStudentIds(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  const active = new Set(await filterActiveStudentIds(unique));
  return unique.filter((id) => !active.has(id));
}

export const INACTIVE_STUDENT_ERROR =
  "This student is not active. New entries cannot be recorded for inactive students.";
