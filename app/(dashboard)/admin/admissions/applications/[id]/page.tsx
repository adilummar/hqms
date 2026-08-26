import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { admissionApplications, classes, students } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import {
  admitApplicationFromForm,
  updateApplicationStatusFromForm,
} from "@/lib/actions/admissions";
import { AdmissionDecisionForm } from "@/components/admissions/admission-decision-form";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Application Details" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  shortlisted: "bg-blue-50 text-blue-800 border border-blue-200",
  selected: "bg-green-50 text-green-800 border border-green-200",
  rejected: "bg-red-50 text-red-800 border border-red-200",
};

function isPreviewableImage(path: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(path);
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-2.5 border-b border-border/60 last:border-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}



export default async function ApplicationDetailsPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;

  const [application, activeClasses, admittedStudent, allAcademicYears] = await Promise.all([
    db.query.admissionApplications.findFirst({
      where: eq(admissionApplications.id, id),
      with: {
        reviewedByUser: true,
        academicYear: true,
      },
    }),
    db.query.classes.findMany({
      where: eq(classes.isActive, true),
      orderBy: [asc(classes.displayOrder), asc(classes.name)],
    }),
    db.query.students.findFirst({
      where: eq(students.applicationId, id),
    }),
    db.query.academicYears.findMany({
      orderBy: (ay, { desc }) => [desc(ay.startDate)],
    }),
  ]);

  if (!application) notFound();

  if (!application) notFound();

  return (
    <div>
      <PageHeader
        title={application.applicationNumber}
        description={application.applicantName}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Admissions" },
          { label: "Applications", href: "/admin/admissions/applications" },
          { label: application.applicationNumber },
        ]}
        action={
          <span className={`text-xs px-2.5 py-1 rounded-sm capitalize font-medium ${statusColors[application.status]}`}>
            {application.status}
          </span>
        }
      />

      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 text-red-700 rounded-sm px-4 py-3 text-sm">
          Could not complete the action. Please check the required fields and try again.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-playfair text-lg font-semibold mb-4">Application Details</h2>
            <dl>
              <DetailRow label="Applicant" value={application.applicantName} />
              <DetailRow label="Date of Birth" value={new Date(application.dateOfBirth).toLocaleDateString("en-IN")} />
              <DetailRow label="Identification Mark" value={application.identificationMark} />
              <DetailRow label="Applied Tracks" value={application.appliedTracks.map((track) => (
                <span key={track} className="inline-flex mr-1 mb-1 px-2 py-0.5 text-xs rounded-sm bg-muted border border-border capitalize">
                  {track}
                </span>
              ))} />
              <DetailRow label="Academic Year" value={application.academicYear?.label} />
              <DetailRow label="Submitted" value={new Date(application.createdAt).toLocaleString("en-IN")} />
            </dl>
          </section>

          <section className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-playfair text-lg font-semibold mb-4">Parent / Guardian</h2>
            <dl>
              <DetailRow label="Father" value={application.fatherName} />
              <DetailRow label="Father Occupation" value={application.fatherOccupation} />
              <DetailRow label="Mother" value={application.motherName} />
              <DetailRow label="Phone" value={application.guardianPhone} />
              <DetailRow label="Alternate Phone" value={application.alternatePhone} />
              <DetailRow label="Email" value={application.guardianEmail} />
              <DetailRow label="School" value={application.schoolName} />
              <DetailRow label="Address" value={application.address} />
            </dl>
          </section>

          <section className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-playfair text-lg font-semibold mb-4">Review History</h2>
            <dl>
              <DetailRow label="Reviewed By" value={application.reviewedByUser?.username} />
              <DetailRow label="Reviewed At" value={application.reviewedAt ? new Date(application.reviewedAt).toLocaleString("en-IN") : "—"} />
              <DetailRow label="Rejection Reason" value={application.rejectionReason} />
              <DetailRow
                label="Student Record"
                value={
                  admittedStudent ? (
                    <Link href={`/admin/students/${admittedStudent.id}`} className="text-primary hover:underline">
                      {admittedStudent.studentCode}
                    </Link>
                  ) : (
                    "Not admitted yet"
                  )
                }
              />
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-playfair text-lg font-semibold mb-4">Documents</h2>
            <div className="space-y-5">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Student Photo</p>
                {isPreviewableImage(application.photoUrl) && (
                  <Image
                    src={application.photoUrl}
                    alt={application.applicantName}
                    width={180}
                    height={240}
                    className="w-36 h-44 object-cover rounded-sm border border-border mb-2"
                  />
                )}
                <Link href={application.photoUrl} target="_blank" className="text-sm text-primary hover:underline">
                  Open photo
                </Link>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Payment Screenshot</p>
                {isPreviewableImage(application.paymentScreenshotUrl) && (
                  <Image
                    src={application.paymentScreenshotUrl}
                    alt="Payment screenshot"
                    width={240}
                    height={160}
                    className="w-full max-h-48 object-contain rounded-sm border border-border mb-2"
                  />
                )}
                <Link href={application.paymentScreenshotUrl} target="_blank" className="text-sm text-primary hover:underline">
                  Open payment proof
                </Link>
              </div>
            </div>
          </section>

          <section className="border border-border rounded-lg bg-card p-5">
            <h2 className="font-playfair text-lg font-semibold mb-4">Application Actions</h2>
            <div className="space-y-4">
              {application.status === "pending" && (
                <form action={updateApplicationStatusFromForm}>
                  <input type="hidden" name="id" value={application.id} />
                  <input type="hidden" name="status" value="shortlisted" />
                  <button className="w-full h-9 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors">
                    Shortlist Application
                  </button>
                </form>
              )}

              {application.status !== "selected" && application.status !== "rejected" ? (
                <AdmissionDecisionForm
                  applicationId={application.id}
                  academicYears={allAcademicYears}
                  classes={activeClasses}
                />
              ) : (
                !admittedStudent && application.status !== "rejected" && (
                  <p className="text-sm text-muted-foreground border border-border rounded-sm p-3">
                    Add active Hifz, Madrasa, and School classes before giving admission.
                  </p>
                )
              )}

              {application.status !== "rejected" && application.status !== "selected" && (
                <form action={updateApplicationStatusFromForm} className="space-y-2">
                  <input type="hidden" name="id" value={application.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <label className="block text-xs text-muted-foreground">Rejection Reason</label>
                  <textarea
                    name="rejectionReason"
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-background resize-none"
                    placeholder="Optional note for the record"
                  />
                  <button className="w-full h-9 border border-red-300 text-red-700 text-sm font-medium rounded-sm hover:bg-red-50 transition-colors">
                    Reject Application
                  </button>
                </form>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
