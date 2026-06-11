"use server";

import { db } from "@/lib/db";
import { students, parents, users, enrollments, monthlyTargets } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { currentTargetPeriod, getDefaultMonthlyTarget } from "@/lib/hifz-targets";

export async function submitAdmissionForm(formData: FormData) {
  const session = await requireAdmin();

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const dateOfBirth = formData.get("dateOfBirth") as string;
  const gender = formData.get("gender") as "male" | "female";
  const bloodGroup = formData.get("bloodGroup") as string;
  const address = formData.get("address") as string;
  const admissionDate = formData.get("admissionDate") as string;
  const academicYearId = formData.get("academicYearId") as string;

  const fatherName = formData.get("fatherName") as string;
  const motherName = formData.get("motherName") as string;
  const primaryPhone = formData.get("primaryPhone") as string;
  const secondaryPhone = formData.get("secondaryPhone") as string;

  const hifzClassId = formData.get("hifzClassId") as string;
  const madrasaClassId = formData.get("madrasaClassId") as string;
  const schoolClassId = formData.get("schoolClassId") as string;

  if (!firstName || !dateOfBirth || !gender || !address || !admissionDate || !fatherName || !primaryPhone || !hifzClassId || !madrasaClassId || !schoolClassId) {
    return { error: "Please fill in all required fields." };
  }

  try {
    // Generate student code
    // simple format: HQMS-YYYY-XXXX
    const year = new Date(admissionDate).getFullYear();
    const countQuery = await db.query.students.findMany();
    const sequence = String(countQuery.length + 1).padStart(4, "0");
    const studentCode = `HQMS-${year}-${sequence}`;

    // Generate parent credentials
    const username = `parent_${studentCode.toLowerCase()}`;
    const password = "password123"; // default password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.transaction(async (tx) => {
      // 1. Create Student
      const [newStudent] = await tx.insert(students).values({
        studentCode,
        firstName,
        lastName: lastName || null,
        dateOfBirth,
        gender,
        bloodGroup: bloodGroup || null,
        address,
        admissionDate,
        admissionYearId: academicYearId,
        status: "active",
      }).returning();

      // 2. Create Parent User
      const [newUser] = await tx.insert(users).values({
        username,
        passwordHash,
        role: "parent",
        isActive: true,
      }).returning();

      // 3. Create Parent Record
      await tx.insert(parents).values({
        userId: newUser.id,
        studentId: newStudent.id,
        fatherName,
        motherName: motherName || null,
        primaryPhone,
        whatsappNumber: secondaryPhone || null,
      });

      // 4. Create Enrollments
      await tx.insert(enrollments).values([
        {
          studentId: newStudent.id,
          classId: hifzClassId,
          academicYearId,
          yearOfStudy: "1",
          status: "active",
        },
        {
          studentId: newStudent.id,
          classId: madrasaClassId,
          academicYearId,
          yearOfStudy: "1",
          status: "active",
        },
        {
          studentId: newStudent.id,
          classId: schoolClassId,
          academicYearId,
          yearOfStudy: "1",
          status: "active",
        },
      ]);

      const targetPeriod = currentTargetPeriod(new Date(admissionDate));
      await tx
        .insert(monthlyTargets)
        .values({
          studentId: newStudent.id,
          year: targetPeriod.year,
          month: targetPeriod.month,
          targetJuz: String(getDefaultMonthlyTarget("1")),
          setBy: session.user.id,
          notes: "Auto target on admission",
        })
        .onConflictDoNothing();

      return { student: newStudent, parentUsername: username, parentPassword: password };
    });

    revalidatePath("/admin/students");
    revalidatePath("/admin");
    return { success: true, ...result };
  } catch (error) {
    console.error("Admission Error:", error);
    return { error: error instanceof Error ? error.message : "Failed to submit admission" };
  }
}
