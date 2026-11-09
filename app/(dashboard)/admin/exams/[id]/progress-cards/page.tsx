import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examinations, students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buildProgressCardData } from "@/lib/exams/progress-card";
import { PrintButton } from "@/components/ui/print-button";
import { ProgressReportCard } from "@/components/exams/ProgressReportCard";
import { ProgressCardControls } from "@/components/exams/progress-card-controls";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    studentId?: string;
    obtained?: string;
    memorized?: string;
    mentor?: string;
    madrasaTeacher?: string;
    schoolTeacher?: string;
  }>;
}

export default async function ProgressCardsPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const { studentId } = sp;

  const examination = await db.query.examinations.findFirst({
    where: eq(examinations.id, id),
  });
  if (!examination) notFound();

  const allStudents = await db.query.students.findMany({
    where: eq(students.status, "active"),
    orderBy: (s, { asc }) => [asc(s.firstName)],
  });

  const overrides = {
    toBeObtained: sp.obtained,
    memorizedJuz: sp.memorized,
    mentor: sp.mentor,
    madrasaTeacher: sp.madrasaTeacher,
    schoolTeacher: sp.schoolTeacher,
  };

  const result = studentId ? await buildProgressCardData(id, studentId, overrides) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Progress Cards"
          description={`Generate progress cards for ${examination.name}`}
          breadcrumbs={[
            { label: "Admin" },
            { label: "Exams", href: "/admin/exams" },
            { label: examination.name, href: `/admin/exams/${id}` },
            { label: "Progress Cards" },
          ]}
          action={
            result?.success && (
              <PrintButton className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
                Print Card
              </PrintButton>
            )
          }
        />

        <ProgressCardControls
          examinationId={id}
          students={allStudents.map((s) => ({
            id: s.id,
            label: `${s.admissionNumber ? `[${s.admissionNumber}] ` : ""}${s.firstName} ${s.lastName ?? ""}`.trim(),
          }))}
          studentId={studentId ?? null}
          current={{
            toBeObtained: sp.obtained,
            memorizedJuz: sp.memorized,
            mentor: sp.mentor,
            madrasaTeacher: sp.madrasaTeacher,
            schoolTeacher: sp.schoolTeacher,
          }}
        />
      </div>

      {result?.success ? (
        <ProgressReportCard data={result.data} />
      ) : studentId ? (
        <div className="text-center p-8 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">Could not generate progress card for this student.</p>
        </div>
      ) : null}
    </div>
  );
}
