import { requireSchoolAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects, examMarks, enrollments, students } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MarkEntryGrid } from "@/components/exams/mark-entry-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function SchoolAdminMarkEntryPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  await requireSchoolAdmin();
  const { id, classId } = await params;

  // Fetch exam session (ensure it's school track)
  const exam = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, id), eq(examSessions.track, "school")),
  });

  if (!exam) notFound();

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

  // Fetch enrolled students
  const classEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.classId, classId),
      eq(enrollments.status, "active"),
      eq(enrollments.academicYearId, exam.academicYearId)
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
        <Link href="/school-admin" className={buttonVariants({ variant: "outline", size: "icon" })}>
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
