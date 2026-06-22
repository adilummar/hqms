import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, juzTracker, hifzDailyEntries, enrollments, parents, admissionApplications } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { JuzGrid } from "@/components/hifz/juz-grid";
import { StatusBadge } from "@/components/students/status-badge";
import { StudentStatusPanel } from "@/components/students/student-status-panel";
import { PreMemorizedJuzMarker } from "@/components/hifz/pre-memorized-juz-marker";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Student Profile" };

interface Props {
  params: Promise<{ id: string }>;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
      <dt className="text-muted-foreground shrink-0 mr-4">{label}</dt>
      <dd className="font-medium text-foreground text-right">{value || "—"}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-playfair text-base font-semibold mb-3">{title}</h3>
      <dl className="space-y-0">{children}</dl>
    </div>
  );
}

export default async function StudentProfilePage({ params }: Props) {
  await requireTutor();
  const { id } = await params;

  // Fetch student first — if not found, 404 immediately
  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });

  if (!student) notFound();

  // Fetch all related data in parallel
  const [application, juzData, recentEntries, studentEnrollments, parentInfo] =
    await Promise.all([
      // Fetch application separately to avoid relational query issues
      student.applicationId
        ? db.query.admissionApplications.findFirst({
            where: eq(admissionApplications.id, student.applicationId),
          })
        : Promise.resolve(null),
      db.query.juzTracker.findMany({
        where: eq(juzTracker.studentId, id),
        orderBy: [asc(juzTracker.juzNumber)],
      }),
      db.query.hifzDailyEntries.findMany({
        where: eq(hifzDailyEntries.studentId, id),
        orderBy: [desc(hifzDailyEntries.date)],
        limit: 30,
      }),
      db.query.enrollments.findMany({
        where: and(eq(enrollments.studentId, id), eq(enrollments.status, "active")),
        with: { class: true },
      }),
      db.query.parents.findFirst({
        where: eq(parents.studentId, id),
      }),
    ]);

  const app = application ?? null;

  const juzCells = Array.from({ length: 30 }, (_, i) => {
    const entry = juzData.find((j) => j.juzNumber === i + 1);
    return {
      juzNumber: i + 1,
      status: (entry?.status ?? "not_started") as "not_started" | "in_progress" | "completed",
      startDate: entry?.startDate,
      completionDate: entry?.completionDate,
    };
  });

  const hifzClass = studentEnrollments.find((e) => e.class.track === "hifz");
  const madrasaClass = studentEnrollments.find((e) => e.class.track === "madrasa");
  const schoolClass = studentEnrollments.find((e) => e.class.track === "school");

  // Build address from individual fields or fallback to combined
  const addressParts = [
    app?.houseName,
    app?.place,
    app?.postOffice && `P.O. ${app.postOffice}`,
    app?.pincode,
    app?.district,
    app?.state,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0
    ? addressParts.join(", ")
    : (student.address ?? app?.address ?? null);

  return (
    <div>
      <PageHeader
        title={`${student.firstName} ${student.lastName ?? ""}`}
        description={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="font-jetbrains text-xs bg-muted px-2 py-0.5 rounded">
              {student.studentCode}
            </span>
            {student.admissionNumber && (
              <span className="font-jetbrains text-xs bg-foreground text-background px-2 py-0.5 rounded">
                AD No. {student.admissionNumber}
              </span>
            )}
          </span>
        }
        breadcrumbs={[
          { label: "Admin" },
          { label: "Students", href: "/admin/students" },
          { label: `${student.firstName} ${student.lastName ?? ""}` },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/students/${id}/edit`}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-primary/90 transition-colors"
            >
              Edit Profile
            </Link>
            <Link
              href={`/admin/students/${id}/admission-form`}
              className="px-3 py-1.5 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
            >
              Admission Form
            </Link>
            <StatusBadge status={student.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Personal Information */}
          <SectionCard title="Personal Information">
            <Row label="Admission Number" value={student.admissionNumber ? `AD No. ${student.admissionNumber}` : undefined} />
            <Row label="Date of Birth" value={student.dateOfBirth} />
            <Row label="Gender" value="Male" />
            <Row label="Blood Group" value={student.bloodGroup} />
            <Row label="Nationality" value={student.nationality} />
            <Row label="Religion" value={student.religion} />
            <Row label="Admission Date" value={student.admissionDate} />
            <Row label="Aadhaar Number" value={app?.aadhaarNumber} />
            <Row label="Identification Mark" value={app?.identificationMark} />
            {student.medicalNotes && (
              <Row label="Medical Notes" value={student.medicalNotes} />
            )}
          </SectionCard>

          {/* Address — from student structured fields or application fields */}
          {(student.houseName || student.district || app?.houseName || fullAddress) && (
            <SectionCard title="Address">
              {(student.houseName || app?.houseName) && (
                <Row label="House Name" value={student.houseName ?? app?.houseName} />
              )}
              {(student.post || app?.place) && (
                <Row label="Post / Place" value={student.post ?? app?.place} />
              )}
              {(student.district || app?.district) && (
                <Row label="District" value={student.district ?? app?.district} />
              )}
              {(student.state || app?.state) && (
                <Row label="State" value={student.state ?? app?.state} />
              )}
              {(student.pin || app?.pincode) && (
                <Row label="PIN Code" value={student.pin ?? app?.pincode} />
              )}
              {!student.houseName && !app?.houseName && fullAddress && (
                <Row label="Address" value={fullAddress} />
              )}
            </SectionCard>
          )}

          {/* Parent / Guardian */}
          <SectionCard title="Parent / Guardian">
            <Row label="Father's Name" value={parentInfo?.fatherName ?? app?.fatherName} />
            <Row label="Father's Occupation" value={parentInfo?.occupation ?? app?.fatherOccupation} />
            <Row label="Mother's Name" value={parentInfo?.motherName ?? app?.motherName} />
            <Row label="Guardian" value={app?.guardianName} />
            <Row label="Relation" value={app?.guardianRelation} />
            <Row label="Phone" value={parentInfo?.primaryPhone ?? app?.guardianPhone} />
            <Row label="WhatsApp" value={parentInfo?.whatsappNumber ?? app?.alternatePhone} />
            <Row label="Email" value={parentInfo?.email ?? app?.guardianEmail} />
          </SectionCard>

          {/* School & Madrasa */}
          {(app?.schoolName || app?.madrasaName) && (
            <SectionCard title="School & Madrasa">
              {app?.schoolName && (
                <>
                  <Row label="School" value={app.schoolName} />
                  <Row label="School Class" value={app.schoolClass} />
                </>
              )}
              {app?.madrasaName && (
                <>
                  <Row label="Madrasa" value={app.madrasaName} />
                  <Row label="Affiliation No." value={app.madrasaAffiliationNumber} />
                  <Row label="Madrasa Class" value={app.madrasaClass} />
                </>
              )}
            </SectionCard>
          )}

          {/* Class Enrollments */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-playfair text-base font-semibold mb-3">Class Enrollments</h3>
            <div className="space-y-2">
              {[
                { label: "Hifz", cls: hifzClass },
                { label: "Madrasa", cls: madrasaClass },
                { label: "School", cls: schoolClass },
              ].map(({ label, cls }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-medium px-2 py-0.5 rounded-sm text-xs ${cls ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                    {cls?.class.name ?? "Not enrolled"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Student Status Panel — change active/discontinued/completed */}
          <StudentStatusPanel
            studentId={student.id}
            currentStatus={student.status as "active" | "completed" | "discontinued"}
            studentName={`${student.firstName} ${student.lastName ?? ""}`.trim()}
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Juz Grid */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-playfair text-base font-semibold">Juz Tracker</h3>
              <Link
                href={`/admin/students/${id}/juz`}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Edit dates
              </Link>
            </div>
            <JuzGrid juzData={juzCells} readonly />
          </div>

          {/* Memorized Juz Manager — mark pre-memorized or reset completed juz */}
          <PreMemorizedJuzMarker
            studentId={student.id}
            completedJuzNumbers={juzData
              .filter((j) => j.status === "completed")
              .map((j) => j.juzNumber)}
            inProgressJuzNumbers={juzData
              .filter((j) => j.status === "in_progress")
              .map((j) => j.juzNumber)}
          />


          {/* Recent Hifz Log */}
          <div className="bg-card border border-border rounded-lg">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-playfair text-base font-semibold">Recent Hifz Log (Last 30 Days)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Sabaq</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Juz</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Sabaq Juz</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Daura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No entries recorded
                      </td>
                    </tr>
                  ) : (
                    recentEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-jetbrains">{entry.date}</td>
                        <td className="px-4 py-2.5 font-jetbrains">
                          {entry.sabaqFromPage && entry.sabaqToPage
                            ? `${entry.sabaqFromPage}→${entry.sabaqToPage}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-jetbrains">
                          {entry.sabaqJuzNumber ? `Juz ${entry.sabaqJuzNumber}` : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {entry.sabaqJuzGiven === true ? (
                            <span className="text-green-600">✓</span>
                          ) : entry.sabaqJuzGiven === false ? (
                            <span className="text-red-500">✗</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-jetbrains">
                          {entry.dauraJuzNumbers?.length ? `Juz ${entry.dauraJuzNumbers.join(", ")}` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
