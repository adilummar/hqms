/**
 * lib/utils/codes.ts
 * Shared utilities for generating sequential student codes and admission numbers.
 * Both follow the same pattern: find the highest existing number, return next.
 */

import { db } from "@/lib/db";
import { students, academicYears } from "@/lib/db/schema";
import { desc, max, sql } from "drizzle-orm";

/**
 * Generate the next system student code: HQMS-YYYY-XXXX
 * Uses the year of admission date.
 */
export async function generateStudentCode(year: number): Promise<string> {
  const pattern = `HQMS-${year}-%`;
  const result = await db
    .select({ code: students.studentCode })
    .from(students)
    .where(sql`${students.studentCode} LIKE ${pattern}`)
    .orderBy(desc(students.studentCode))
    .limit(1);

  let next = 1;
  if (result[0]) {
    const parts = result[0].code.split("-");
    next = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `HQMS-${year}-${String(next).padStart(4, "0")}`;
}

/**
 * Generate the next admission number (simple integer like 150, 151...).
 * Finds the highest numeric admission_number across ALL students and returns +1.
 * Returns a string for DB storage.
 */
export async function generateNextAdmissionNumber(): Promise<string> {
  const result = await db
    .select({ maxAdNo: sql<string>`MAX(CAST(${students.admissionNumber} AS INTEGER))` })
    .from(students)
    .where(sql`${students.admissionNumber} ~ '^[0-9]+$'`); // only numeric ones

  const maxNum = result[0]?.maxAdNo ? parseInt(result[0].maxAdNo, 10) : 0;
  return String(maxNum + 1);
}

/**
 * Check if an admission number is already taken by a different student.
 * Returns the conflicting student's id if found, null otherwise.
 */
export async function checkAdmissionNumberConflict(
  admissionNumber: string,
  excludeStudentId?: string
): Promise<{ id: string; firstName: string; lastName: string | null; studentCode: string } | null> {
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      studentCode: students.studentCode,
    })
    .from(students)
    .where(sql`${students.admissionNumber} = ${admissionNumber}`)
    .limit(1);

  if (!rows[0]) return null;
  if (excludeStudentId && rows[0].id === excludeStudentId) return null;
  return rows[0];
}

/**
 * Generate the next batch number (simple integer: 1, 2, 3...).
 * Finds the highest batchNumber across all batches and returns +1.
 */
export async function generateNextBatchNumber(): Promise<number> {
  const result = await db
    .select({ maxBatch: sql<number>`MAX(${academicYears.batchNumber})` })
    .from(academicYears);

  const maxNum = result[0]?.maxBatch ?? 0;
  return (maxNum || 0) + 1;
}
