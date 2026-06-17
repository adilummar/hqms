"use server";

/**
 * lib/actions/bulk-import.ts
 * Server action: bulk import students from a parsed Excel/CSV.
 *
 * Logic per row:
 *   1. Validate with Zod schema
 *   2. Look up hifzClass, schoolClass, madrasaClass by name in DB
 *   3. Look up batch by batchNumber
 *   4. If admissionNumber already exists → check it's the SAME student → update
 *   5. If admissionNumber does not exist → insert new student
 *   6. If admissionNumber conflicts (exists but belongs to a different name) → flag as conflict
 *      (imported anyway, conflict reported back for review)
 */

import { db } from "@/lib/db";
import {
  students,
  parents,
  users,
  enrollments,
  classes,
  academicYears,
  monthlyTargets,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import {
  bulkImportRowSchema,
  type BulkImportRow,
  type BulkImportRowResult,
} from "@/lib/validators/bulk-import.schema";
import { generateStudentCode, generateNextAdmissionNumber } from "@/lib/utils/codes";
import { revalidatePath } from "next/cache";
import { eq, and, sql, max as sqlMax } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { currentTargetPeriod, getDefaultMonthlyTarget } from "@/lib/hifz-targets";

/** Raw row as it comes from the parsed Excel (all strings) */
export interface RawImportRow {
  adNo: string;
  firstName: string;
  fatherName: string;
  phone: string;
  houseName?: string;
  post?: string;
  district?: string;
  state?: string;
  pin?: string;
  dateOfBirth: string;
  bloodGroup?: string;
  hifzClass: string;
  schoolClass: string;
  madrasaClass: string;
  batch: string;
}

export interface BulkImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  conflicts: BulkImportRowResult[];
  errors: BulkImportRowResult[];
  total: number;
  /** Batch numbers that were auto-created during this import */
  autoBatches: number[];
}

export async function bulkImportStudents(
  rawRows: RawImportRow[]
): Promise<BulkImportResult> {
  const session = await requireRole(["admin", "super_admin"]);

  // ── Load all lookup data once ──────────────────────────────────────────────
  const [allClasses, allBatches] = await Promise.all([
    db.query.classes.findMany({ where: eq(classes.isActive, true) }),
    db.query.academicYears.findMany(),
  ]);

  // Build maps for O(1) lookups
  const hifzClassMap  = new Map(allClasses.filter(c => c.track === "hifz").map(c => [c.name.toLowerCase(), c]));
  const schoolClassMap = new Map(allClasses.filter(c => c.track === "school").map(c => [c.name.toLowerCase(), c]));
  const madrasaClassMap = new Map(allClasses.filter(c => c.track === "madrasa").map(c => [c.name.toLowerCase(), c]));
  const batchMap = new Map(allBatches.filter(b => b.batchNumber != null).map(b => [b.batchNumber!, b]));

  const results: BulkImportRowResult[] = [];
  let inserted = 0;
  let updated = 0;
  const autoBatchNumbers: number[] = []; // track newly created batches

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowIndex = i + 1;

    // ── Step 1: Validate ──────────────────────────────────────────────────────
    const parsed = bulkImportRowSchema.safeParse(rawRow);
    if (!parsed.success) {
      const msgs = Object.values(parsed.error.flatten().fieldErrors).flat().join("; ");
      results.push({
        rowIndex,
        adNo: rawRow.adNo ?? "?",
        firstName: rawRow.firstName ?? "?",
        status: "error",
        message: msgs,
      });
      continue;
    }

    const row: BulkImportRow = parsed.data;

    // ── Step 2: Resolve class IDs ─────────────────────────────────────────────
    const hifzCls   = hifzClassMap.get(row.hifzClass.toLowerCase());
    const schoolCls = schoolClassMap.get(row.schoolClass.toLowerCase());
    const madrasaCls = madrasaClassMap.get(row.madrasaClass.toLowerCase());

    const classErrors: string[] = [];
    if (!hifzCls)   classErrors.push(`Hifz class "${row.hifzClass}" not found`);
    if (!schoolCls)  classErrors.push(`School class "${row.schoolClass}" not found`);
    if (!madrasaCls) classErrors.push(`Madrasa class "${row.madrasaClass}" not found`);

    if (classErrors.length > 0) {
      results.push({
        rowIndex,
        adNo: row.adNo,
        firstName: row.firstName,
        status: "error",
        message: classErrors.join("; "),
      });
      continue;
    }

    // ── Step 3: Resolve batch — auto-create if not found ─────────────────────
    let batch = batchMap.get(row.batch);
    if (!batch) {
      // Create the batch automatically with default dates
      const today = new Date();
      const oneYearLater = new Date(today);
      oneYearLater.setFullYear(today.getFullYear() + 1);

      const [newBatch] = await db
        .insert(academicYears)
        .values({
          label: String(row.batch),
          batchNumber: row.batch,
          startDate: today,
          endDate: oneYearLater,
          isCurrent: false, // don't change current batch during import
        })
        .returning();

      // Track the new batch so we can report it, reuse for subsequent rows
      batchMap.set(row.batch, newBatch);
      batch = newBatch;
      if (!autoBatchNumbers.includes(row.batch)) {
        autoBatchNumbers.push(row.batch);
      }
    }

    // ── Step 4: Check if AD NO already exists ─────────────────────────────────
    const existingByAdNo = await db.query.students.findFirst({
      where: eq(students.admissionNumber, row.adNo),
    });

    // Build combined address string
    const addressParts = [row.houseName, row.post, row.district, row.state, row.pin].filter(Boolean);
    const combinedAddress = addressParts.join(", ");
    const admissionDate = new Date().toISOString().split("T")[0]; // today

    try {
      if (existingByAdNo) {
        // ─ UPDATE existing student ────────────────────────────────────────────
        // Check for name conflict (might be a completely different person)
        const isNameMatch = existingByAdNo.firstName.toLowerCase() === row.firstName.toLowerCase();

        if (!isNameMatch) {
          // Conflict: same AD NO but different name — still import but flag
          const suggestedAdNo = await generateNextAdmissionNumber();
          results.push({
            rowIndex,
            adNo: row.adNo,
            firstName: row.firstName,
            status: "conflict",
            message: `AD NO ${row.adNo} belongs to "${existingByAdNo.firstName} ${existingByAdNo.lastName ?? ""}". Imported with suggested number ${suggestedAdNo}.`,
            suggestedAdNo,
            conflictStudentName: `${existingByAdNo.firstName} ${existingByAdNo.lastName ?? ""}`,
          });
          // Don't skip — fall through to insert with suggested number below
          await insertNewStudent({
            row,
            admissionNumber: suggestedAdNo,
            studentCodeYear: new Date().getFullYear(),
            batchId: batch.id,
            hifzClassId: hifzCls!.id,
            schoolClassId: schoolCls!.id,
            madrasaClassId: madrasaCls!.id,
            combinedAddress,
            admissionDate,
            adminUserId: session.user.id,
          });
          inserted++;
          continue;
        }

        // Same person → update
        await db
          .update(students)
          .set({
            firstName: row.firstName,
            bloodGroup: row.bloodGroup ?? null,
            houseName: row.houseName ?? null,
            post: row.post ?? null,
            district: row.district ?? null,
            state: row.state ?? null,
            pin: row.pin ?? null,
            address: combinedAddress || null,
            updatedAt: new Date(),
          })
          .where(eq(students.id, existingByAdNo.id));

        // Update parent
        const parentRecord = await db.query.parents.findFirst({
          where: eq(parents.studentId, existingByAdNo.id),
        });
        if (parentRecord) {
          await db
            .update(parents)
            .set({
              fatherName: row.fatherName,
              primaryPhone: row.phone,
              updatedAt: new Date(),
            })
            .where(eq(parents.id, parentRecord.id));
        }

        await logActivity(session.user.id, "student.bulk_update", "student", existingByAdNo.id);
        results.push({
          rowIndex,
          adNo: row.adNo,
          firstName: row.firstName,
          status: "updated",
          message: `Updated existing student (${existingByAdNo.studentCode})`,
        });
        updated++;
      } else {
        // ─ INSERT new student ─────────────────────────────────────────────────
        const admissionNumber = row.adNo; // use the AD NO from file directly
        const studentId = await insertNewStudent({
          row,
          admissionNumber,
          studentCodeYear: new Date().getFullYear(),
          batchId: batch.id,
          hifzClassId: hifzCls!.id,
          schoolClassId: schoolCls!.id,
          madrasaClassId: madrasaCls!.id,
          combinedAddress,
          admissionDate,
          adminUserId: session.user.id,
        });

        await logActivity(session.user.id, "student.bulk_insert", "student", studentId);
        results.push({
          rowIndex,
          adNo: row.adNo,
          firstName: row.firstName,
          status: "inserted",
          message: `Inserted new student`,
        });
        inserted++;
      }
    } catch (err) {
      results.push({
        rowIndex,
        adNo: row.adNo,
        firstName: row.firstName,
        status: "error",
        message: err instanceof Error ? err.message : "Unknown database error",
      });
    }
  }

  revalidatePath("/admin/students");

  return {
    success: true,
    inserted,
    updated,
    conflicts: results.filter((r) => r.status === "conflict"),
    errors: results.filter((r) => r.status === "error"),
    total: rawRows.length,
    autoBatches: autoBatchNumbers,
  };
}

// ── Helper: insert a brand-new student ────────────────────────────────────────
async function insertNewStudent(opts: {
  row: BulkImportRow;
  admissionNumber: string;
  studentCodeYear: number;
  batchId: string;
  hifzClassId: string;
  schoolClassId: string;
  madrasaClassId: string;
  combinedAddress: string;
  admissionDate: string;
  adminUserId: string;
}): Promise<string> {
  const {
    row, admissionNumber, studentCodeYear, batchId,
    hifzClassId, schoolClassId, madrasaClassId,
    combinedAddress, admissionDate, adminUserId,
  } = opts;

  const studentCode = await generateStudentCode(studentCodeYear);

  // Parent login: username = phone, password = fatherName + last 4 digits
  const parentUsername = `${row.fatherName.replace(/\s+/g, "").toLowerCase()}${row.phone.slice(-4)}`;
  const parentPassword = parentUsername;
  const parentPwHash = await bcrypt.hash(parentPassword, 10);

  // Student login: username = phone, password = DOB as DDMMYYYY
  const [yyyy, mm, dd] = row.dateOfBirth.split("-");
  const studentPassword = `${dd}${mm}${yyyy}`;
  const studentPwHash = await bcrypt.hash(studentPassword, 10);

  return await db.transaction(async (tx) => {
    // 1. Parent user
    const [parentUser] = await tx
      .insert(users)
      .values({ username: parentUsername, passwordHash: parentPwHash, role: "parent", isActive: true })
      .onConflictDoNothing()
      .returning();

    // 2. Student user
    const [studentUser] = await tx
      .insert(users)
      .values({ username: row.phone, passwordHash: studentPwHash, role: "student", isActive: true })
      .onConflictDoNothing()
      .returning();

    // 3. Student record
    const [newStudent] = await tx
      .insert(students)
      .values({
        studentCode,
        admissionNumber,
        userId: studentUser?.id ?? null,
        firstName: row.firstName,
        gender: "male", // all students are male
        dateOfBirth: row.dateOfBirth,
        bloodGroup: row.bloodGroup ?? null,
        houseName: row.houseName ?? null,
        post: row.post ?? null,
        district: row.district ?? null,
        state: row.state ?? null,
        pin: row.pin ?? null,
        address: combinedAddress || null,
        admissionDate,
        admissionYearId: batchId,
        status: "active",
      })
      .returning();

    // 4. Parent record (only if parent user was created)
    if (parentUser) {
      await tx.insert(parents).values({
        userId: parentUser.id,
        studentId: newStudent.id,
        fatherName: row.fatherName,
        primaryPhone: row.phone,
      });
    }

    // 5. Enrollments
    await tx.insert(enrollments).values([
      { studentId: newStudent.id, classId: hifzClassId,   academicYearId: batchId, yearOfStudy: "1st", status: "active" },
      { studentId: newStudent.id, classId: schoolClassId,  academicYearId: batchId, yearOfStudy: "1st", status: "active" },
      { studentId: newStudent.id, classId: madrasaClassId, academicYearId: batchId, yearOfStudy: "1st", status: "active" },
    ]).onConflictDoNothing();

    // 6. Monthly target
    const targetPeriod = currentTargetPeriod(new Date(admissionDate));
    await tx
      .insert(monthlyTargets)
      .values({
        studentId: newStudent.id,
        year: targetPeriod.year,
        month: targetPeriod.month,
        targetJuz: String(getDefaultMonthlyTarget("1st")),
        setBy: adminUserId,
        notes: "Auto target on bulk import",
      })
      .onConflictDoNothing();

    return newStudent.id;
  });
}

/** Update a student's admission number (for conflict resolution) */
export async function updateAdmissionNumber(
  studentId: string,
  newAdmissionNumber: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole(["admin", "super_admin"]);

  // Check conflict
  const existing = await db.query.students.findFirst({
    where: eq(students.admissionNumber, newAdmissionNumber),
  });
  if (existing && existing.id !== studentId) {
    return {
      success: false,
      error: `Admission number ${newAdmissionNumber} is already assigned to ${existing.firstName} ${existing.lastName ?? ""} (${existing.studentCode})`,
    };
  }

  await db
    .update(students)
    .set({ admissionNumber: newAdmissionNumber, updatedAt: new Date() })
    .where(eq(students.id, studentId));

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/students");
  return { success: true };
}
