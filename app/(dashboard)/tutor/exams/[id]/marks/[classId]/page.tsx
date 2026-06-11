import { requireTutor, getSession } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, classes, examSubjects, examMarks, enrollments } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MarkEntryGrid } from "@/components/exams/mark-entry-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function TutorMarkEntryPage({
  params,
}: {
  params: Promise<{ id: string; classId: string }>;
}) {
  const session = await requireTutor();
  const { id, classId } = await params;

  // Fetch class details
  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
  });

  if (!cls) notFound();

  // Verify access: tutor can only access their own class
  const isTutor = session.user.role === "tutor";
  if (isTutor && cls.tutorId !== session.user.id) {
    redirect("/unauthorized");
  }

  // Fetch exam session
  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, id),
  });

  if (!exam) notFound();

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
        <Link href="/tutor/exams" className={buttonVariants({ variant: "outline", size: "icon" })}>
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
