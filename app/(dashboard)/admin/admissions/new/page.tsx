import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes, academicYears, batches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { AdmissionForm } from "@/components/admissions/admission-form";
import { generateNextAdmissionNumber } from "@/lib/utils/codes";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Admission" };

export default async function NewAdmissionPage() {
  await requireAdmin();

  const [allClasses, currentYear, allBatches, nextAdmissionNumber] = await Promise.all([
    db.query.classes.findMany({
      where: eq(classes.isActive, true),
    }),
    db.query.academicYears.findFirst({
      where: eq(academicYears.isCurrent, true),
    }),
    db.query.batches.findMany({
      orderBy: (b, { asc }) => [asc(b.batchNumber)],
    }),
    generateNextAdmissionNumber(),
  ]);

  if (!currentYear) {
    return (
      <div>
        <PageHeader title="New Admission" />
        <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200 mt-4">
          Error: No active academic year found. Please create an academic year in Settings → Batch &amp; Year Management first.
        </div>
      </div>
    );
  }

  const hifzClasses    = allClasses.filter((c) => c.track === "hifz");
  const madrasaClasses = allClasses.filter((c) => c.track === "madrasa");
  const schoolClasses  = allClasses.filter((c) => c.track === "school");

  // Default batch = latest (highest batchNumber)
  const latestBatch = allBatches[allBatches.length - 1];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="New Admission"
        description={`Academic Year: ${currentYear.label} · Enroll a new student`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Students", href: "/admin/students" },
          { label: "New Admission" },
        ]}
      />

      <div className="mt-6 bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6">
          <AdmissionForm
            hifzClasses={hifzClasses}
            madrasaClasses={madrasaClasses}
            schoolClasses={schoolClasses}
            academicYearId={currentYear.id}
            nextAdmissionNumber={nextAdmissionNumber}
            allBatches={allBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              label: b.label,
            }))}
            defaultBatchId={latestBatch?.id ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
