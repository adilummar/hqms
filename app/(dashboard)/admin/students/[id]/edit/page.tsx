import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, parents, admissionApplications, juzTracker } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StudentProfileEditForm } from "@/components/students/student-profile-edit-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Student Profile" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditStudentProfilePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  // Fetch student first — if not found, 404 immediately
  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });

  if (!student) notFound();

  const [application, parentInfo, juzRows] = await Promise.all([
    student.applicationId
      ? db.query.admissionApplications.findFirst({
          where: eq(admissionApplications.id, student.applicationId),
        })
      : Promise.resolve(null),
    db.query.parents.findFirst({
      where: eq(parents.studentId, id),
    }),
    db.query.juzTracker.findMany({
      where: eq(juzTracker.studentId, id),
    }),
  ]);

  const app = application ?? null;
  const fullName = `${student.firstName} ${student.lastName ?? ""}`.trim();

  const defaultValues = {
    // students
    firstName: student.firstName,
    lastName: student.lastName ?? "",
    dateOfBirth: student.dateOfBirth,
    gender: (student.gender as "male" | "female") ?? "male",
    bloodGroup: student.bloodGroup ?? "",
    nationality: student.nationality ?? "",
    religion: student.religion ?? "",
    admissionDate: student.admissionDate,
    photoUrl: student.photoUrl ?? "",
    medicalNotes: student.medicalNotes ?? "",

    // parents
    fatherName: parentInfo?.fatherName ?? app?.fatherName ?? "",
    fatherOccupation: parentInfo?.occupation ?? app?.fatherOccupation ?? "",
    motherName: parentInfo?.motherName ?? app?.motherName ?? "",
    guardianName: app?.guardianName ?? "",
    guardianRelation: app?.guardianRelation ?? "",
    primaryPhone: parentInfo?.primaryPhone ?? app?.guardianPhone ?? "",
    whatsappNumber: parentInfo?.whatsappNumber ?? app?.alternatePhone ?? "",
    email: parentInfo?.email ?? app?.guardianEmail ?? "",

    // address (prefer application individual fields, fallback to address string)
    houseName: app?.houseName ?? "",
    place: app?.place ?? "",
    postOffice: app?.postOffice ?? "",
    pincode: app?.pincode ?? "",
    district: app?.district ?? "",
    state: app?.state ?? "",

    // educational
    aadhaarNumber: app?.aadhaarNumber ?? "",
    identificationMark: app?.identificationMark ?? "",
    schoolName: app?.schoolName ?? "",
    schoolClass: app?.schoolClass ?? "",
    madrasaName: app?.madrasaName ?? "",
    madrasaAffiliationNumber: app?.madrasaAffiliationNumber ?? "",
    madrasaClass: app?.madrasaClass ?? "",
  };

  return (
    <div>
      <PageHeader
        title={`Edit Profile — ${fullName}`}
        description={student.studentCode}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Students", href: "/admin/students" },
          { label: fullName, href: `/admin/students/${id}` },
          { label: "Edit Profile" },
        ]}
      />

      <StudentProfileEditForm
        studentId={id}
        defaultValues={defaultValues}
        studentName={fullName}
        juzRows={juzRows.map((r) => ({
          juzNumber: r.juzNumber,
          status: r.status as "not_started" | "in_progress" | "completed",
          startDate: r.startDate ?? null,
          completionDate: r.completionDate ?? null,
        }))}
      />
    </div>
  );
}
