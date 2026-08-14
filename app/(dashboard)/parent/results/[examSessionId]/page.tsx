import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  examSessions,
  examSubjects,
  examMarks,
  examGradeRules,
  enrollments,
  students,
  classes,
  users,
  juzTracker,
  monthlyTargets,
} from "@/lib/db/schema";
import { eq, and, inArray, asc, desc, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ProgressReportCard } from "@/components/exams/ProgressReportCard";

export default async function ParentResultDetailPage({
  params,
}: {
  params: Promise<{ examSessionId: string }>;
}) {
  await requireParent();
  const studentId = await getParentStudentId();
  const { examSessionId } = await params;

  // 1. Fetch current student details
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });
  if (!student) notFound();

  // 2. Fetch current exam session
  const currentExam = await db.query.examSessions.findFirst({
    where: and(
      eq(examSessions.id, examSessionId),
      eq(examSessions.resultStatus, "published")
    ),
  });
  if (!currentExam) notFound();

  // 3. Fetch all active student enrollments with class & tutor
  const studentEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.studentId, studentId),
    with: {
      class: {
        with: {
          tutor: true,
        },
      },
    },
  });
  const classIds = studentEnrollments.map((e) => e.classId);
  const enrolledClassIds = classIds.length > 0 ? classIds : ["none"];

  // 4. Fetch all published exam sessions in this academic year
  const academicExams = await db.query.examSessions.findMany({
    where: and(
      eq(examSessions.academicYearId, currentExam.academicYearId),
      eq(examSessions.resultStatus, "published")
    ),
  });

  // Helper to fetch results for a specific track
  const getTrackResults = async (track: "hifz" | "madrasa" | "school") => {
    const trackExams = academicExams.filter((e) => e.track === track);
    if (trackExams.length === 0) return undefined;

    const enrollment = studentEnrollments.find((e) => e.class?.track === track);
    if (!enrollment || !enrollment.class) return undefined;

    const trackClass = enrollment.class;
    const trackExamIds = trackExams.map((e) => e.id);

    const subjects = await db.query.examSubjects.findMany({
      where: and(
        inArray(examSubjects.examSessionId, trackExamIds),
        eq(examSubjects.classId, trackClass.id)
      ),
      orderBy: [asc(examSubjects.displayOrder)],
    });
    if (subjects.length === 0) return undefined;

    const subjectIds = subjects.map((s) => s.id);

    const studentMarks = await db.query.examMarks.findMany({
      where: and(
        inArray(examMarks.examSubjectId, subjectIds),
        eq(examMarks.studentId, studentId)
      ),
    });
    if (studentMarks.length === 0) return undefined;

    const gradeRules = await db.query.examGradeRules.findMany({
      where: inArray(examGradeRules.examSessionId, trackExamIds),
      orderBy: [desc(examGradeRules.minPercentage)],
    });

    const getGrade = (percentage: number) => {
      for (const rule of gradeRules) {
        if (percentage >= Number(rule.minPercentage)) {
          return rule.grade;
        }
      }
      return "F";
    };

    let hasFail = false;
    const subjectResults = subjects.map((sub) => {
      const mark = studentMarks.find((m) => m.examSubjectId === sub.id);
      const scored = mark && !mark.isAbsent && mark.marksObtained !== null ? Number(mark.marksObtained) : 0;
      const isPassed = mark ? (!mark.isAbsent && scored >= sub.passMarks) : false;
      if (!isPassed) hasFail = true;

      const percentage = sub.totalMarks > 0 ? (scored / sub.totalMarks) * 100 : 0;
      const grade = mark?.isAbsent ? "Absent" : getGrade(percentage);

      return {
        subjectName: sub.name,
        totalMarks: sub.totalMarks,
        obtainedMarks: scored,
        passMarks: sub.passMarks,
        isPassed,
        grade,
      };
    });

    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, trackClass.id),
        eq(enrollments.status, "active")
      ),
    });
    const classStudentIds = classEnrollments.map((e) => e.studentId);

    const classMarks =
      classStudentIds.length > 0
        ? await db.query.examMarks.findMany({
            where: and(
              inArray(examMarks.examSubjectId, subjectIds),
              inArray(examMarks.studentId, classStudentIds)
            ),
          })
        : [];

    const studentTotals = classStudentIds.map((sId) => {
      const sMarks = classMarks.filter((m) => m.studentId === sId);
      const scoredSum = sMarks.reduce((sum, m) => {
        return sum + (m.isAbsent ? 0 : Number(m.marksObtained ?? 0));
      }, 0);
      return { studentId: sId, totalObtained: scoredSum };
    });

    studentTotals.sort((a, b) => b.totalObtained - a.totalObtained);
    const rankIdx = studentTotals.findIndex((s) => s.studentId === studentId);
    const rank = rankIdx !== -1 ? rankIdx + 1 : null;

    let memorizedJuz: number | undefined;
    let toBeObtained: number | undefined;

    if (track === "hifz") {
      const completedJuzCount = await db
        .select({ count: count() })
        .from(juzTracker)
        .where(
          and(
            eq(juzTracker.studentId, studentId),
            eq(juzTracker.status, "completed")
          )
        );
      memorizedJuz = completedJuzCount[0]?.count ?? 0;

      const targetJuzObj = await db.query.monthlyTargets.findFirst({
        where: and(
          eq(monthlyTargets.studentId, studentId),
          eq(monthlyTargets.year, new Date().getFullYear()),
          eq(monthlyTargets.month, new Date().getMonth() + 1)
        ),
      });
      toBeObtained = targetJuzObj ? Number(targetJuzObj.targetJuz) : 30;
    }

    return {
      className: trackClass.name,
      tutorName: trackClass.tutor?.username ?? "—",
      rank,
      status: hasFail ? "FAILED" : "PASS",
      subjectResults,
      memorizedJuz,
      toBeObtained,
    };
  };

  const [hifzResult, madrasaResult, schoolResult] = await Promise.all([
    getTrackResults("hifz"),
    getTrackResults("madrasa"),
    getTrackResults("school"),
  ]);

  const academicYear = await db.query.academicYears.findFirst({
    where: eq(classes.academicYearId, currentExam.academicYearId),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Link href="/parent" className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="Progress Report"
          description="View and print your child's term progress card"
        />
      </div>

      <ProgressReportCard
        student={{
          admissionNumber: student.admissionNumber || null,
          firstName: student.firstName,
          lastName: student.lastName,
          studentCode: student.studentCode,
        }}
        examSessionName={currentExam.name}
        academicYearLabel={academicYear?.label ?? ""}
        hifzResult={hifzResult}
        madrasaResult={madrasaResult}
        schoolResult={schoolResult}
      />
    </div>
  );
}
