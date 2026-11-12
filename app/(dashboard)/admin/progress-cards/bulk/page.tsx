import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { academicYears, classes, examinations, examSessions, examSubjects } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { BulkProgressCards } from "@/components/exams/bulk-progress-cards";

export const metadata = { title: "Bulk Progress Cards" };

export default async function BulkProgressCardsPage() {
  await requireAdmin();

  const [years, exams, classRows] = await Promise.all([
    db.select({ id: academicYears.id, label: academicYears.label }).from(academicYears).orderBy(desc(academicYears.startDate)),
    db
      .select({ id: examinations.id, name: examinations.name, academicYearId: examinations.academicYearId })
      .from(examinations)
      .orderBy(desc(examinations.createdAt)),
    // The classes that really take part in each examination: subjects in the exam session of the class's own track
    db
      .selectDistinct({
        examinationId: examSessions.examinationId,
        track: examSessions.track,
        classId: classes.id,
        className: classes.name,
        classTrack: classes.track,
      })
      .from(examSubjects)
      .innerJoin(examSessions, eq(examSessions.id, examSubjects.examSessionId))
      .innerJoin(classes, eq(classes.id, examSubjects.classId))
      .orderBy(asc(classes.name)),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Bulk Progress Cards"
        description="Generate and download progress cards for a whole class"
        breadcrumbs={[{ label: "Admin" }, { label: "Exams", href: "/admin/exams" }, { label: "Bulk Progress Cards" }]}
      />
      <BulkProgressCards
        years={years}
        exams={exams}
        classOptions={classRows.filter((c) => c.track === c.classTrack)}
      />
    </div>
  );
}
