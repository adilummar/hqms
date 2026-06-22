import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, parents, enrollments, admissionApplications, academicYears } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admission Form" };

interface Props {
  params: Promise<{ id: string }>;
}

function value(text: string | null | undefined) {
  return text && text.trim() ? text : "-";
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB");
}

function admissionNumber(studentCode: string) {
  return studentCode.split("-").at(-1)?.replace(/^0+/, "") || studentCode;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_12px_1fr] gap-2 text-[12px] leading-5">
      <span>{label}</span>
      <span>:</span>
      <span className="font-medium">{children || "-"}</span>
    </div>
  );
}

export default async function AdmissionFormPrintPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  // Fetch student first — if not found, 404 immediately
  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });

  if (!student) notFound();

  const [application, admissionYear, parentInfo, activeEnrollments] = await Promise.all([
    student.applicationId
      ? db.query.admissionApplications.findFirst({
          where: eq(admissionApplications.id, student.applicationId),
        })
      : Promise.resolve(null),
    db.query.academicYears.findFirst({
      where: eq(academicYears.id, student.admissionYearId),
    }),
    db.query.parents.findFirst({
      where: eq(parents.studentId, id),
    }),
    db.query.enrollments.findMany({
      where: and(eq(enrollments.studentId, id), eq(enrollments.status, "active")),
      with: { class: true },
    }),
  ]);

  const app = application ?? null;
  const hifzClass = activeEnrollments.find((item) => item.class.track === "hifz");
  const madrasaClass = activeEnrollments.find((item) => item.class.track === "madrasa");
  const schoolClass = activeEnrollments.find((item) => item.class.track === "school");
  const fullName = `${student.firstName} ${student.lastName ?? ""}`.trim();
  const addressParts = value(parentInfo?.address ?? student.address ?? app?.address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const place = addressParts[0] ?? "-";
  const post = addressParts[1] ?? place;
  const district = addressParts[2] ?? "-";
  const admissionNo = admissionNumber(student.studentCode);

  return (
    <div className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full justify-between px-4 print:hidden">
        <Link
          href={`/admin/students/${student.id}`}
          className="inline-flex h-9 items-center rounded-sm border border-border px-4 text-sm hover:bg-muted"
        >
          Back to student
        </Link>
        <PrintButton />
      </div>

      <main className="mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[18mm] py-[18mm] text-black shadow-sm print:min-h-0 print:w-full print:max-w-none print:px-[14mm] print:py-[12mm] print:shadow-none">
        <header className="text-center">
          <h1 className="font-serif text-[17px] font-bold uppercase tracking-wide text-[#8b1e1e]">
            Malabar Islamic Complex Thahfeezul Qur&apos;an College
          </h1>
          <p className="mt-0.5 text-[15px] font-semibold">
            മലബാർ ഇസ്ലാമിക് കോംപ്ലക്സ് തഹ്ഫീളുൽ ഖുർആൻ കോളേജ്
          </p>
          <p className="mt-1 text-[11px]">
            Uduma West, Uduma P.O, Kasaragod Dt., 671319, Kerala, India
          </p>
        </header>

        <section className="mt-12 grid grid-cols-[1fr_130px] gap-8">
          <div className="pt-7 text-center">
            <h2 className="text-[17px] font-bold uppercase tracking-wide">Admission Form</h2>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-[105px] w-[90px] items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-50">
              {student.photoUrl ? (
                <Image
                  src={student.photoUrl}
                  alt={fullName}
                  width={90}
                  height={105}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-neutral-500">Photo</span>
              )}
            </div>
            <p className="mt-2 text-[18px] font-extrabold">AD. NO: {admissionNo}</p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-x-10">
          <div>
            <Field label="Name of Student">{fullName}</Field>
            <Field label="Name of Father">{value(parentInfo?.fatherName ?? app?.fatherName)}</Field>
            <Field label="Name of Mother">{value(parentInfo?.motherName ?? app?.motherName)}</Field>
            <Field label="Name of Guardian">{value(parentInfo?.fatherName ?? app?.fatherName)}</Field>
            <Field label="Relation with student">Father</Field>
            <Field label="Place">{place}</Field>
            <Field label="Post">{post}</Field>
            <Field label="District">{district}</Field>
            <Field label="Class Completed">{value(hifzClass?.yearOfStudy ?? app?.schoolClass)}</Field>
            <Field label="Blood Group">{value(student.bloodGroup)}</Field>
            <Field label="Phone No">{value(parentInfo?.primaryPhone ?? app?.guardianPhone)}</Field>
            <Field label="WhatsApp No">{value(parentInfo?.whatsappNumber ?? app?.alternatePhone)}</Field>
          </div>

          <div>
            <Field label="Date of Birth">{formatDate(student.dateOfBirth)}</Field>
            <Field label="Mahallu">-</Field>
            <Field label="City">{place}</Field>
            <Field label="State">{value(student.nationality === "Indian" ? "Kerala" : student.nationality)}</Field>
            <Field label="Pin">-</Field>
            <Field label="School">{value(schoolClass?.class.name)}</Field>
            <Field label="Aadhar No">{value(app?.aadhaarNumber)}</Field>
            <Field label="2)">{value(parentInfo?.email ?? app?.guardianEmail)}</Field>
            <Field label="2)">{value(madrasaClass?.class.name)}</Field>
          </div>
        </section>

        <div className="mt-20 text-center text-[12px]">Name &amp; Signature of Guardian</div>

        <section className="mt-28">
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-48 bg-black" />
            <h3 className="text-[13px] font-bold uppercase">For Official Use</h3>
            <div className="h-px w-48 bg-black" />
          </div>
          <p className="mt-4 text-[12px] leading-5">
            {fullName} is allotted to study in MIC Thahfeezul Qur&apos;an College,
            Batch {value(admissionYear?.label)}, with the Admission No. {admissionNo} on{" "}
            {formatDate(student.admissionDate)}.
          </p>
        </section>

        <footer className="mt-24 flex justify-end pr-10 text-[12px] leading-5">
          <div>
            <p>Principal</p>
            <p>Jabir Hudawi Chanadukkam</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
