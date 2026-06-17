"use server";

import { db } from "@/lib/db";
import {
  admissionApplications,
  hallTickets,
  students,
  parents,
  enrollments,
  users,
  academicYears,
  monthlyTargets,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import {
  applicationFormSchema,
  updateApplicationStatusSchema,
  generateHallTicketSchema,
  admissionFormSchema,
} from "@/lib/validators/admission.schema";
import { eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentTargetPeriod, getDefaultMonthlyTarget } from "@/lib/hifz-targets";

/** Generate next sequential number for a given prefix and year */
async function generateCode(prefix: string, year: number): Promise<string> {
  const pattern = `${prefix}-${year}-%`;
  const result = await db
    .select({ code: admissionApplications.applicationNumber })
    .from(admissionApplications)
    .where(sql`${admissionApplications.applicationNumber} LIKE ${pattern}`)
    .orderBy(desc(admissionApplications.applicationNumber))
    .limit(1);

  let next = 1;
  if (result[0]) {
    const parts = result[0].code.split("-");
    next = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

async function generateStudentCode(year: number): Promise<string> {
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

export async function submitApplication(input: unknown) {
  const parsed = applicationFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const year = new Date().getFullYear();
  const applicationNumber = await generateCode("APP", year);

  // Get current academic year
  const currentYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isCurrent, true),
  });

  if (!currentYear) {
    return { success: false, error: "No active academic year found" };
  }

  // Build combined address for legacy field
  const combinedAddress = [
    parsed.data.houseName,
    parsed.data.place,
    `P.O. ${parsed.data.postOffice}`,
    parsed.data.pincode,
    parsed.data.district,
    parsed.data.state,
  ]
    .filter(Boolean)
    .join(", ");

  const [application] = await db
    .insert(admissionApplications)
    .values({
      applicationNumber,
      applicantName: parsed.data.applicantName,
      dateOfBirth: parsed.data.dateOfBirth,
      gender: "male", // Default for boys hifz course
      identificationMark: parsed.data.identificationMark,

      // Parent / Guardian
      fatherName: parsed.data.fatherName,
      fatherOccupation: parsed.data.fatherOccupation,
      motherName: parsed.data.motherName,
      guardianName: parsed.data.guardianName,
      guardianRelation: parsed.data.guardianRelation,
      guardianPhone: parsed.data.guardianPhone,
      alternatePhone: parsed.data.alternatePhone,
      guardianEmail: null,

      // Address (individual fields)
      houseName: parsed.data.houseName,
      place: parsed.data.place,
      postOffice: parsed.data.postOffice,
      pincode: parsed.data.pincode,
      district: parsed.data.district,
      state: parsed.data.state,
      address: combinedAddress,

      // Aadhaar
      aadhaarNumber: parsed.data.aadhaarNumber,

      // School
      schoolName: parsed.data.schoolName,
      schoolClass: parsed.data.schoolClass,

      // Madrasa
      madrasaName: parsed.data.madrasaName,
      madrasaAffiliationNumber: parsed.data.madrasaAffiliationNumber,
      madrasaClass: parsed.data.madrasaClass,

      appliedTracks: ["hifz"],
      photoUrl: parsed.data.photoUrl,
      paymentScreenshotUrl: parsed.data.paymentScreenshotUrl,
      documentUrls: [],
      status: "pending",
      academicYearId: currentYear.id,
    })
    .returning();

  return { success: true, data: { applicationNumber: application.applicationNumber } };
}

export async function updateApplicationStatus(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const [updated] = await db
    .update(admissionApplications)
    .set({
      status: parsed.data.status,
      rejectionReason: parsed.data.rejectionReason ?? null,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(admissionApplications.id, parsed.data.id))
    .returning();

  await logActivity(
    session.user.id,
    `admission.${parsed.data.status}`,
    "admission_application",
    updated.id
  );

  revalidatePath("/admin/admissions/applications");
  return { success: true, data: updated };
}

export async function updateApplicationStatusFromForm(formData: FormData) {
  await requireRole(["admin", "super_admin"]);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();

  const parsed = updateApplicationStatusSchema.safeParse({
    id,
    status,
    rejectionReason: rejectionReason || undefined,
  });

  if (!parsed.success) {
    redirect(`/admin/admissions/applications/${id}?error=invalid-status`);
  }

  await updateApplicationStatus(parsed.data);
  revalidatePath(`/admin/admissions/applications/${id}`);
  redirect(`/admin/admissions/applications/${id}`);
}

export async function admitApplicationFromForm(formData: FormData) {
  const session = await requireRole(["admin", "super_admin"]);

  const applicationId = String(formData.get("applicationId") ?? "");
  const hifzClassId = String(formData.get("hifzClassId") ?? "");
  const madrasaClassId = String(formData.get("madrasaClassId") ?? "");
  const schoolClassId = String(formData.get("schoolClassId") ?? "");
  const yearOfStudy = String(formData.get("yearOfStudy") ?? "1st");
  const admissionDate = String(formData.get("admissionDate") ?? new Date().toISOString().split("T")[0]);

  if (!applicationId || !hifzClassId || !madrasaClassId || !schoolClassId) {
    redirect(`/admin/admissions/applications/${applicationId}?error=missing-classes`);
  }

  const application = await db.query.admissionApplications.findFirst({
    where: eq(admissionApplications.id, applicationId),
  });

  if (!application) {
    redirect("/admin/admissions/applications?error=application-not-found");
  }

  const existingStudent = await db.query.students.findFirst({
    where: eq(students.applicationId, application.id),
  });

  if (existingStudent) {
    redirect(`/admin/students/${existingStudent.id}`);
  }

  const year = new Date(admissionDate).getFullYear();
  const studentCode = await generateStudentCode(year);
  const [firstName, ...lastNameParts] = application.applicantName.trim().split(/\s+/);
  const lastName = lastNameParts.join(" ") || null;
  const parentUsername = `parent_${application.applicationNumber.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const tempPassword = `${application.fatherName.replace(/\s+/g, "").toLowerCase()}${application.guardianPhone.slice(-4)}`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const result = await db.transaction(async (tx) => {
    const [parentUser] = await tx
      .insert(users)
      .values({
        username: parentUsername,
        email: application.guardianEmail || null,
        passwordHash,
        role: "parent",
        isActive: true,
      })
      .returning();

    // Auto-create student user account (phone = username, DOB = password)
    const dobDate = new Date(application.dateOfBirth);
    const studentDobPassword = [
      String(dobDate.getDate()).padStart(2, "0"),
      String(dobDate.getMonth() + 1).padStart(2, "0"),
      dobDate.getFullYear(),
    ].join("");
    const studentPasswordHash = await bcrypt.hash(studentDobPassword, 10);
    const [studentUser] = await tx
      .insert(users)
      .values({
        username: application.guardianPhone,
        passwordHash: studentPasswordHash,
        role: "student",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    const [student] = await tx
      .insert(students)
      .values({
        studentCode,
        userId: studentUser?.id ?? null,
        applicationId: application.id,
        firstName: firstName || application.applicantName,
        lastName,
        dateOfBirth: application.dateOfBirth,
        gender: application.gender,
        address: application.address,
        photoUrl: application.photoUrl,
        admissionDate,
        admissionYearId: application.academicYearId,
        status: "active",
      })
      .returning();

    await tx.insert(parents).values({
      userId: parentUser.id,
      studentId: student.id,
      fatherName: application.fatherName,
      motherName: application.motherName,
      primaryPhone: application.guardianPhone,
      whatsappNumber: application.alternatePhone,
      email: application.guardianEmail || null,
      occupation: application.fatherOccupation,
      address: application.address,
    });

    for (const classId of [hifzClassId, madrasaClassId, schoolClassId]) {
      await tx.insert(enrollments).values({
        studentId: student.id,
        classId,
        academicYearId: application.academicYearId,
        yearOfStudy,
        status: "active",
      });
    }

    const targetPeriod = currentTargetPeriod(new Date(admissionDate));
    await tx
      .insert(monthlyTargets)
      .values({
        studentId: student.id,
        year: targetPeriod.year,
        month: targetPeriod.month,
        targetJuz: String(getDefaultMonthlyTarget(yearOfStudy)),
        setBy: session.user.id,
        notes: "Auto target on admission",
      })
      .onConflictDoNothing();

    await tx
      .update(admissionApplications)
      .set({
        status: "selected",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(admissionApplications.id, application.id));

    return { student, parentUsername, tempPassword };
  });

  await logActivity(session.user.id, "admission.selected", "admission_application", application.id);
  await logActivity(session.user.id, "student.create", "student", result.student.id);

  revalidatePath("/admin/admissions/applications");
  revalidatePath(`/admin/admissions/applications/${application.id}`);
  revalidatePath("/admin/students");
  redirect(`/admin/students/${result.student.id}`);
}

export async function generateHallTicket(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = generateHallTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const year = new Date().getFullYear();
  // Generate HT number
  const htPattern = `HT-${year}-%`;
  const lastHT = await db
    .select({ num: hallTickets.hallTicketNumber })
    .from(hallTickets)
    .where(sql`${hallTickets.hallTicketNumber} LIKE ${htPattern}`)
    .orderBy(desc(hallTickets.hallTicketNumber))
    .limit(1);

  let nextHT = 1;
  if (lastHT[0]) {
    const parts = lastHT[0].num.split("-");
    nextHT = parseInt(parts[parts.length - 1], 10) + 1;
  }
  const hallTicketNumber = `HT-${year}-${String(nextHT).padStart(4, "0")}`;

  const [ticket] = await db
    .insert(hallTickets)
    .values({
      applicationId: parsed.data.applicationId,
      hallTicketNumber,
      examDate: parsed.data.examDate,
      examCenter: parsed.data.examCenter,
      examTime: parsed.data.examTime,
      isGenerated: true,
      generatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  await logActivity(
    session.user.id,
    "admission.hall_ticket_generated",
    "hall_ticket",
    ticket?.id
  );

  return { success: true, data: { hallTicketNumber } };
}

export async function completeAdmission(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = admissionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const year = new Date().getFullYear();

  const result = await db.transaction(async (tx) => {
    // 1. Generate student code
    const codePattern = `HQMS-${year}-%`;
    const lastCode = await tx
      .select({ code: students.studentCode })
      .from(students)
      .where(sql`${students.studentCode} LIKE ${codePattern}`)
      .orderBy(desc(students.studentCode))
      .limit(1);

    let nextCode = 1;
    if (lastCode[0]) {
      const parts = lastCode[0].code.split("-");
      nextCode = parseInt(parts[parts.length - 1], 10) + 1;
    }
    const studentCode = `HQMS-${year}-${String(nextCode).padStart(4, "0")}`;

    // 2. Create parent user account
    const tempPassword = `${parsed.data.fatherName.replace(/\s+/g, "").toLowerCase()}${parsed.data.primaryPhone.slice(-4)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const parentUsername = `${parsed.data.fatherName.replace(/\s+/g, "").toLowerCase()}${parsed.data.primaryPhone.slice(-4)}`;

    const [parentUser] = await tx
      .insert(users)
      .values({
        username: parentUsername,
        email: parsed.data.parentEmail || null,
        passwordHash,
        role: "parent",
        isActive: true,
      })
      .returning();

    // Auto-create student user account (phone = username, DOB = password)
    const studentDobDate = new Date(parsed.data.dateOfBirth);
    const studentDobPass = [
      String(studentDobDate.getDate()).padStart(2, "0"),
      String(studentDobDate.getMonth() + 1).padStart(2, "0"),
      studentDobDate.getFullYear(),
    ].join("");
    const studentPwHash = await bcrypt.hash(studentDobPass, 10);
    const [studentUser] = await tx
      .insert(users)
      .values({
        username: parsed.data.primaryPhone,
        passwordHash: studentPwHash,
        role: "student",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    // 3. Create student
    const [student] = await tx
      .insert(students)
      .values({
        studentCode,
        userId: studentUser?.id ?? null,
        applicationId: parsed.data.applicationId ?? null,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth,
        gender: parsed.data.gender,
        bloodGroup: parsed.data.bloodGroup,
        nationality: parsed.data.nationality,
        religion: parsed.data.religion,
        address: parsed.data.address,
        photoUrl: parsed.data.photoUrl,
        medicalNotes: parsed.data.medicalNotes,
        emergencyContact: parsed.data.emergencyContact,
        admissionDate: parsed.data.admissionDate,
        admissionYearId: parsed.data.admissionYearId,
        batchId: (parsed.data as { batchId?: string }).batchId ?? null,
        status: "active",
      })
      .returning();

    // 4. Create parent record
    await tx.insert(parents).values({
      userId: parentUser.id,
      studentId: student.id,
      fatherName: parsed.data.fatherName,
      motherName: parsed.data.motherName,
      primaryPhone: parsed.data.primaryPhone,
      whatsappNumber: parsed.data.whatsappNumber,
      email: parsed.data.parentEmail || null,
      occupation: parsed.data.occupation,
    });

    // 5. Create 3 enrollments (Hifz, Madrasa, School)
    const classIds = [
      { classId: parsed.data.hifzClassId },
      { classId: parsed.data.madrasaClassId },
      { classId: parsed.data.schoolClassId },
    ];

    for (const { classId } of classIds) {
      await tx.insert(enrollments).values({
        studentId: student.id,
        classId,
        academicYearId: parsed.data.admissionYearId,
        yearOfStudy: parsed.data.yearOfStudy,
        status: "active",
      });
    }

    const targetPeriod = currentTargetPeriod(new Date(parsed.data.admissionDate));
    await tx
      .insert(monthlyTargets)
      .values({
        studentId: student.id,
        year: targetPeriod.year,
        month: targetPeriod.month,
        targetJuz: String(getDefaultMonthlyTarget(parsed.data.yearOfStudy)),
        setBy: session.user.id,
        notes: "Auto target on admission",
      })
      .onConflictDoNothing();

    return { student, parentCredentials: { username: parentUsername, tempPassword } };
  });

  await logActivity(
    session.user.id,
    "student.create",
    "student",
    result.student.id
  );

  revalidatePath("/admin/students");
  revalidatePath("/admin/admissions/applications");

  return { success: true, data: result };
}
