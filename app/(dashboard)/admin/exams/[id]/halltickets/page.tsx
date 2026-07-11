import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Ticket, Users } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hall Tickets" };

export default async function HallTicketsClassPickerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
    with: { academicYear: true },
  });

  if (!exam) notFound();
  if (exam.track !== "school") notFound(); // Hall tickets only for school exams

  // Find classes that have subjects assigned
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

  const subjectCountByClass = new Map<string, number>();
  subjects.forEach((s) => {
    subjectCountByClass.set(s.classId, (subjectCountByClass.get(s.classId) || 0) + 1);
  });

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
          title="Hall Tickets"
          description={`${exam.name} · ${exam.academicYear?.label} · Select a class to generate hall tickets`}
        />
      </div>

      {examClasses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          <Ticket className="mx-auto w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">No subjects assigned yet</p>
          <p className="text-sm mt-1">Assign subjects to classes first from the exam setup page.</p>
          <Link href={`/admin/exams/${id}`} className="mt-4 inline-block text-sm text-primary underline">
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
                href={`/admin/exams/${id}/halltickets/${cls.id}`}
                className="group block rounded-xl border bg-card p-6 hover:border-primary hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                    {subjectCount} subject{subjectCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                  {cls.name}
                </h3>
                <p className="text-sm text-muted-foreground">Click to generate hall tickets</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Ticket size={12} /> Generate Hall Tickets →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
