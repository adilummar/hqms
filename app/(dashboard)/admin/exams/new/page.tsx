import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { CreateExamForm } from "@/components/exams/create-exam-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create Exam" };

export default async function NewExamPage() {
  await requireAdmin();

  const years = await db.query.academicYears.findMany({
    orderBy: [desc(academicYears.startDate)],
  });

  return (
    <div>
      <PageHeader
        title="Create Exam Session"
        description="Set up a new exam for School, Madrasa, or Hifz"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Exams", href: "/admin/exams" },
          { label: "New Exam" },
        ]}
      />
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
        <CreateExamForm
          academicYears={years.map(y => ({ id: y.id, label: y.label, isCurrent: y.isCurrent }))}
        />
      </div>
    </div>
  );
}
