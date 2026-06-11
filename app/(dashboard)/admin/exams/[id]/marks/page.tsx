import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ChevronLeft, BookOpen, Users } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function AdminMarksClassPickerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
  });

  if (!exam) notFound();

  // Find classes that have subjects assigned for this exam
  const subjects = await db.query.examSubjects.findMany({
    where: eq(examSubjects.examSessionId, id),
  });

  const classIds = [...new Set(subjects.map((s) => s.classId))];

  let examClasses: typeof classes.$inferSelect[] = [];
  if (classIds.length > 0) {
    examClasses = await db.query.classes.findMany({
      where: inArray(classes.id, classIds),
    });
    examClasses.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Count students per class by looking at enrollments
  // We also want to show total subjects per class
  const subjectCountByClass = new Map<string, number>();
  subjects.forEach((s) => {
    subjectCountByClass.set(s.classId, (subjectCountByClass.get(s.classId) || 0) + 1);
  });

  const isPublished = exam.resultStatus === "published";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/exams/${id}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={`Mark Entry — ${exam.name}`}
          description={`${exam.track} track · Select a class to enter marks`}
        />
      </div>

      {isPublished && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-amber-800 dark:text-amber-400 text-sm">
          ⚠️ Results have been <strong>published</strong>. Mark entry is locked for all classes.
        </div>
      )}

      {examClasses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          <BookOpen className="mx-auto w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">No subjects assigned yet</p>
          <p className="text-sm mt-1">
            Go back to the exam and assign subjects to classes first.
          </p>
          <Link href={`/admin/exams/${exam.id}`} className="mt-4 inline-block text-sm text-primary underline">
            ← Back to Exam Setup
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {examClasses.map((cls) => {
            const subjectCount = subjectCountByClass.get(cls.id) || 0;
            return (
              <Link
                key={cls.id}
                href={`/admin/exams/${id}/marks/${cls.id}`}
                className="group block rounded-xl border bg-card p-6 hover:border-primary hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted capitalize">
                    {cls.track}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                  {cls.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {subjectCount} subject{subjectCount !== 1 ? "s" : ""}
                </p>
                <div className="mt-4 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  {isPublished ? "View marks →" : "Enter marks →"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
