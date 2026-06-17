"use server";

import { db } from "@/lib/db";
import { students, parents, users, enrollments, monthlyTargets } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { currentTargetPeriod, getDefaultMonthlyTarget } from "@/lib/hifz-targets";
import { generateStudentCode, generateNextAdmissionNumber, checkAdmissionNumberConflict } from "@/lib/utils/codes";
import { eq } from "drizzle-orm";

export async function submitAdmissionForm(formData: FormData) {
  const session = await requireAdmin();

  const firstName       = (formData.get("firstName") as string)?.trim();
  const lastName        = (formData.get("lastName") as string)?.trim();
  const dateOfBirth     = formData.get("dateOfBirth") as string;
  const bloodGroup      = formData.get("bloodGroup") as string;
  const admissionDate   = formData.get("admissionDate") as string;
  const academicYearId  = formData.get("academicYearId") as string;

  // Structured address
  const houseName = (formData.get("houseName") as string)?.trim();
  const post      = (formData.get("post") as string)?.trim();
  const district  = (formData.get("district") as string)?.trim();
  const state     = (formData.get("state") as string)?.trim();
  const pin       = (formData.get("pin") as string)?.trim();
  const combinedAddress = [houseName, post, district, state, pin].filter(Boolean).join(", ");

  // Admission number: use provided or auto-generate
  let admissionNumber = (formData.get("admissionNumber") as string)?.trim();

  const fatherName    = (formData.get("fatherName") as string)?.trim();
  const motherName    = (formData.get("motherName") as string)?.trim();
  const primaryPhone  = (formData.get("primaryPhone") as string)?.trim();
  const secondaryPhone = (formData.get("secondaryPhone") as string)?.trim();

  const hifzClassId    = formData.get("hifzClassId") as string;
  const madrasaClassId = formData.get("madrasaClassId") as string;
  const schoolClassId  = formData.get("schoolClassId") as string;
  const batchId        = (formData.get("batchId") as string)?.trim() || null;

  if (!firstName || !dateOfBirth || !admissionDate || !fatherName || !primaryPhone || !hifzClassId || !madrasaClassId || !schoolClassId) {
    return { error: "Please fill in all required fields." };
  }

  // If no manual admission number given, auto-generate next
  if (!admissionNumber) {
    admissionNumber = await generateNextAdmissionNumber();
  } else {
    // Check for conflict with existing student
    const conflict = await checkAdmissionNumberConflict(admissionNumber);
    if (conflict) {
      return {
        error: `Admission number ${admissionNumber} is already assigned to ${conflict.firstName} ${conflict.lastName ?? ""} (${conflict.studentCode}). Please choose a different number.`,
      };
    }
  }

  try {
    const year = new Date(admissionDate).getFullYear();
    const studentCode = await generateStudentCode(year);

    // Parent credentials: username = fatherName+last4digits, password = same
    const parentUsername = `${fatherName.replace(/\s+/g, "").toLowerCase()}${primaryPhone.slice(-4)}`;
    const parentPassword = parentUsername;
    const parentPwHash   = await bcrypt.hash(parentPassword, 10);

    // Student credentials: username = phone, password = DOB as DDMMYYYY
    const [yyyy, mm, dd] = dateOfBirth.split("-");
    const studentPassword = `${dd}${mm}${yyyy}`;
    const studentPwHash   = await bcrypt.hash(studentPassword, 10);

    const result = await db.transaction(async (tx) => {
      // 1. Create Student
      const [newStudent] = await tx.insert(students).values({
        studentCode,
        admissionNumber,
        firstName,
        lastName: lastName || null,
        dateOfBirth,
        gender: "male",          // All students are male
        bloodGroup: bloodGroup || null,
        houseName: houseName || null,
        post: post || null,
        district: district || null,
        state: state || null,
        pin: pin || null,
        address: combinedAddress || null,
        admissionDate,
        admissionYearId: academicYearId,
        batchId: batchId || null,
        status: "active",
      }).returning();

      // 2. Create Parent User
      const [newUser] = await tx.insert(users).values({
        username: parentUsername,
        passwordHash: parentPwHash,
        role: "parent",
        isActive: true,
      }).onConflictDoNothing().returning();

      // 3. Create Student User
      const [studentUser] = await tx.insert(users).values({
        username: primaryPhone,
        passwordHash: studentPwHash,
        role: "student",
        isActive: true,
      }).onConflictDoNothing().returning();

      // Link student user if created
      if (studentUser) {
        await tx.update(students).set({ userId: studentUser.id }).where(eq(students.id, newStudent.id));
      }

      // 4. Create Parent Record
      if (newUser) {
        await tx.insert(parents).values({
          userId: newUser.id,
          studentId: newStudent.id,
          fatherName,
          motherName: motherName || null,
          primaryPhone,
          whatsappNumber: secondaryPhone || null,
        });
      }

      // 5. Create Enrollments
      await tx.insert(enrollments).values([
        { studentId: newStudent.id, classId: hifzClassId,    academicYearId, yearOfStudy: "1st", status: "active" },
        { studentId: newStudent.id, classId: madrasaClassId, academicYearId, yearOfStudy: "1st", status: "active" },
        { studentId: newStudent.id, classId: schoolClassId,  academicYearId, yearOfStudy: "1st", status: "active" },
      ]).onConflictDoNothing();

      // 6. Initial monthly target
      const targetPeriod = currentTargetPeriod(new Date(admissionDate));
      await tx.insert(monthlyTargets).values({
        studentId: newStudent.id,
        year: targetPeriod.year,
        month: targetPeriod.month,
        targetJuz: String(getDefaultMonthlyTarget("1st")),
        setBy: session.user.id,
        notes: "Auto target on admission",
      }).onConflictDoNothing();

      return {
        student: newStudent,
        parentUsername,
        parentPassword,
        admissionNumber,
      };
    });

    revalidatePath("/admin/students");
    revalidatePath("/admin");
    return { success: true, ...result };
  } catch (error) {
    console.error("Admission Error:", error);
    return { error: error instanceof Error ? error.message : "Failed to submit admission" };
  }
}
