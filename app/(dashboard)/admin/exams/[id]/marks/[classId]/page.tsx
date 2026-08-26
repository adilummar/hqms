import { requireAdmin } from "@/lib/auth/helpers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects, examMarks, enrollments } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MarkEntryGrid } from "@/components/exams/mark-entry-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function AdminMarkEntryPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  await requireAdmin();
  const session = await auth();
  const { id, classId } = await params;

  // Fetch exam session
  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
  });

  if (!exam) notFound();

  if (exam.tutorMarkEntryOnly && session?.user?.role !== "tutor") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/admin/exams/${exam.id}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <PageHeader
            title="Access Denied"
            description={`${exam.name} • ${exam.track} track`}
          />
        </div>
        <div className="rounded-md border bg-amber-50 text-amber-800 px-4 py-6 text-center border-amber-200">
          <h5 className="font-semibold text-lg mb-2">Restricted Mark Entry</h5>
          <p>
            This exam is configured to <strong>only allow assigned class tutors</strong> to enter marks.
            As an administrator, your mark entry access is currently blocked for this session.
          </p>
        </div>
      </div>
    );
  }

  // Fetch class details
  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
  });

  if (!cls) notFound();

  // Fetch subjects for this class in this exam
  const subjects = await db.query.examSubjects.findMany({
    where: and(
      eq(examSubjects.examSessionId, id),
      eq(examSubjects.classId, classId)
    ),
    orderBy: [asc(examSubjects.displayOrder)],
  });

  // Fetch enrolled students — classId + active is sufficient (matches attendance page pattern)
  const classEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.classId, classId),
      eq(enrollments.status, "active")
    ),
    with: {
      student: true,
    },
  });

  const enrolledStudents = classEnrollments
    .map(e => e.student)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  // Fetch existing marks
  const subjectIds = subjects.map(s => s.id);
  const studentIds = enrolledStudents.map(s => s.id);

  let marks: typeof examMarks.$inferSelect[] = [];
  if (subjectIds.length > 0 && studentIds.length > 0) {
    marks = await db.query.examMarks.findMany({
      where: and(
        inArray(examMarks.examSubjectId, subjectIds),
        inArray(examMarks.studentId, studentIds)
      ),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/exams/${exam.id}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={`Mark Entry: ${cls.name}`}
          description={`${exam.name} • ${exam.track} track`}
        />
      </div>

      <MarkEntryGrid
        examSession={exam}
        examClass={cls}
        subjects={subjects}
        students={enrolledStudents}
        initialMarks={marks}
      />
    </div>
  );
}
