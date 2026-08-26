import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, juzTracker } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { JuzDatesEditor } from "@/components/hifz/juz-dates-editor";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Juz Dates" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JuzDatesPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });
  if (!student) notFound();

  const juzData = await db.query.juzTracker.findMany({
    where: eq(juzTracker.studentId, id),
    orderBy: [asc(juzTracker.juzNumber)],
  });

  // Build full 30-juz array, filling gaps with not_started defaults
  const juzRows = Array.from({ length: 30 }, (_, i) => {
    const entry = juzData.find((j) => j.juzNumber === i + 1);
    return {
      juzNumber: i + 1,
      status: (entry?.status ?? "not_started") as
        | "not_started"
        | "in_progress"
        | "completed",
      startDate: entry?.startDate ?? null,
      completionDate: entry?.completionDate ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Edit Juz Dates"
        description={`Manage Juz progress dates for ${student.firstName} ${student.lastName ?? ""}`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Students", href: "/admin/students" },
          {
            label: `${student.firstName} ${student.lastName ?? ""}`,
            href: `/admin/students/${id}`,
          },
          { label: "Edit Juz Dates" },
        ]}
      />

      <JuzDatesEditor
        studentId={id}
        initialRows={juzRows}
      />
    </div>
  );
}
