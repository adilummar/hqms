"use server";

import { db } from "@/lib/db";
import { students, parents, admissionApplications, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";


const updateProfileSchema = z.object({
  studentId: z.string().uuid(),

  // students table
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  gender: z.enum(["male", "female"]),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  admissionDate: z.string().min(1, "Admission date required"),
  photoUrl: z.string().optional(),
  medicalNotes: z.string().optional(),

  // parents table
  fatherName: z.string().min(1, "Father name required"),
  fatherOccupation: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  primaryPhone: z.string().min(10, "Valid phone required"),
  whatsappNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),

  // address (stored on application + combined on student)
  houseName: z.string().optional(),
  place: z.string().optional(),
  postOffice: z.string().optional(),
  pincode: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),

  // educational (application)
  aadhaarNumber: z.string().optional(),
  identificationMark: z.string().optional(),
  schoolName: z.string().optional(),
  schoolClass: z.string().optional(),
  madrasaName: z.string().optional(),
  madrasaAffiliationNumber: z.string().optional(),
  madrasaClass: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export async function updateStudentProfile(input: unknown) {
  const session = await requireRole(["admin", "super_admin"]);
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  const combinedAddress = [d.houseName, d.place, d.postOffice && `P.O. ${d.postOffice}`, d.pincode, d.district, d.state]
    .filter(Boolean)
    .join(", ");

  // 1. Update students table
  await db
    .update(students)
    .set({
      firstName: d.firstName,
      lastName: d.lastName || null,
      dateOfBirth: d.dateOfBirth,
      gender: d.gender,
      bloodGroup: d.bloodGroup || null,
      nationality: d.nationality || null,
      religion: d.religion || null,
      admissionDate: d.admissionDate,
      photoUrl: d.photoUrl || null,
      medicalNotes: d.medicalNotes || null,
      address: combinedAddress || null,
      updatedAt: new Date(),
    })
    .where(eq(students.id, d.studentId));

  // 2. Update parents table (upsert-style: update if exists)
  const existing = await db.query.parents.findFirst({
    where: eq(parents.studentId, d.studentId),
  });

  if (existing) {
    await db
      .update(parents)
      .set({
        fatherName: d.fatherName,
        motherName: d.motherName || null,
        primaryPhone: d.primaryPhone,
        whatsappNumber: d.whatsappNumber || null,
        email: d.email || null,
        occupation: d.fatherOccupation || null,
        address: combinedAddress || null,
        updatedAt: new Date(),
      })
      .where(eq(parents.studentId, d.studentId));
  }

  // 3. Update admission_applications if linked
  const student = await db.query.students.findFirst({
    where: eq(students.id, d.studentId),
    columns: { applicationId: true },
  });

  if (student?.applicationId) {
    await db
      .update(admissionApplications)
      .set({
        applicantName: `${d.firstName} ${d.lastName ?? ""}`.trim(),
        fatherName: d.fatherName,
        fatherOccupation: d.fatherOccupation ?? undefined,
        motherName: d.motherName || null,
        guardianName: d.guardianName || null,
        guardianRelation: d.guardianRelation || null,
        guardianPhone: d.primaryPhone,
        alternatePhone: d.whatsappNumber || null,
        houseName: d.houseName || null,
        place: d.place || null,
        postOffice: d.postOffice || null,
        pincode: d.pincode || null,
        district: d.district || null,
        state: d.state || null,
        address: combinedAddress || null,
        aadhaarNumber: d.aadhaarNumber || null,
        identificationMark: d.identificationMark ?? undefined,
        schoolName: d.schoolName || null,
        schoolClass: d.schoolClass || null,
        madrasaName: d.madrasaName || null,
        madrasaAffiliationNumber: d.madrasaAffiliationNumber || null,
        madrasaClass: d.madrasaClass || null,
        updatedAt: new Date(),
      })
      .where(eq(admissionApplications.id, student.applicationId));
  }

  await logActivity(session.user.id, "student.profile_update", "student", d.studentId);
  revalidatePath(`/admin/students/${d.studentId}`);
  revalidatePath(`/admin/students/${d.studentId}/admission-form`);

  return { success: true };
}

// ── Update Admission Number (inline edit from profile page) ───────────────────
export async function updateAdmissionNumber(studentId: string, admissionNumber: string) {
  const session = await requireRole(["admin", "super_admin"]);

  const trimmed = admissionNumber.trim();

  // Check uniqueness (ignore if same student already has it)
  if (trimmed) {
    const existing = await db.query.students.findFirst({
      where: eq(students.admissionNumber, trimmed),
      columns: { id: true },
    });
    if (existing && existing.id !== studentId) {
      return { success: false, error: "Admission number already assigned to another student." };
    }
  }

  await db
    .update(students)
    .set({ admissionNumber: trimmed || null, updatedAt: new Date() })
    .where(eq(students.id, studentId));

  await logActivity(session.user.id, "student.admission_number_update", "student", studentId);
  revalidatePath(`/admin/students/${studentId}`);
  return { success: true };
}
