import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, academicYears } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EditExamForm } from "@/components/exams/edit-exam-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Exam" };

interface Props { params: Promise<{ id: string }>; }

export default async function EditExamPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [exam, years] = await Promise.all([
    db.query.examSessions.findFirst({ where: eq(examSessions.id, id) }),
    db.query.academicYears.findMany({ orderBy: [desc(academicYears.startDate)] }),
  ]);

  if (!exam) notFound();

  return (
    <div>
      <PageHeader
        title="Edit Exam"
        description={`Editing: ${exam.name}`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Exams", href: "/admin/exams" },
          { label: exam.name, href: `/admin/exams/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
        <EditExamForm
          exam={{
            id: exam.id,
            name: exam.name,
            track: exam.track,
            academicYearId: exam.academicYearId,
            startDate: exam.startDate ?? "",
            endDate: exam.endDate ?? "",
            status: exam.status,
          }}
          academicYears={years.map(y => ({ id: y.id, label: y.label, isCurrent: y.isCurrent }))}
        />
      </div>
    </div>
  );
}
