import { requireStudent, getStudentProfileId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { examSessions, examSubjects, examMarks, examGradeRules, enrollments } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function StudentResultDetailPage({
  params,
}: {
  params: Promise<{ examSessionId: string }>;
}) {
  await requireStudent();
  const studentId = await getStudentProfileId();
  const { examSessionId } = await params;

  // Fetch the exam
  const exam = await db.query.examSessions.findFirst({
    where: and(
      eq(examSessions.id, examSessionId),
      eq(examSessions.resultStatus, "published") // Ensure it's published!
    ),
  });

  if (!exam) notFound();

  // Fetch enrollments to get class IDs
  const studentEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.studentId, studentId),
  });
  const classIds = studentEnrollments.map((e) => e.classId);

  // Fetch subjects for this exam & student's classes
  const subjects = await db.query.examSubjects.findMany({
    where: and(
      eq(examSubjects.examSessionId, examSessionId),
      classIds.length > 0 ? inArray(examSubjects.classId, classIds) : undefined
    ),
    orderBy: [asc(examSubjects.displayOrder)],
  });

  const subjectIds = subjects.map((s) => s.id);

  // Fetch student's marks
  let marks: typeof examMarks.$inferSelect[] = [];
  if (subjectIds.length > 0) {
    marks = await db.query.examMarks.findMany({
      where: and(
        inArray(examMarks.examSubjectId, subjectIds),
        eq(examMarks.studentId, studentId)
      ),
    });
  }

  // Fetch grade rules
  const gradeRules = await db.query.examGradeRules.findMany({
    where: eq(examGradeRules.examSessionId, examSessionId),
    orderBy: [asc(examGradeRules.displayOrder)],
  });

  // Helper to determine grade based on rules
  const getGrade = (percentage: number) => {
    // Rules are ordered by displayOrder, which is usually best grade to worst (e.g., A+ to F)
    // Actually, it's safer to sort them by minPercentage descending
    const sortedRules = [...gradeRules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));
    for (const rule of sortedRules) {
      if (percentage >= Number(rule.minPercentage)) {
        return rule;
      }
    }
    return null; // Fallback
  };

  // Compute totals
  let totalMaxMarks = 0;
  let totalObtainedMarks = 0;
  let hasFailingSubject = false;
  let hasAbsent = false;

  const subjectResults = subjects.map((subject) => {
    const mark = marks.find((m) => m.examSubjectId === subject.id);
    const obtained = mark && !mark.isAbsent && mark.marksObtained !== null ? Number(mark.marksObtained) : 0;
    
    totalMaxMarks += subject.totalMarks;
    
    if (mark?.isAbsent) {
      hasAbsent = true;
    } else {
      totalObtainedMarks += obtained;
    }

    const percentage = (obtained / subject.totalMarks) * 100;
    const gradeRule = getGrade(percentage);
    const isPassed = !mark?.isAbsent && obtained >= subject.passMarks;
    
    if (!isPassed) {
      hasFailingSubject = true;
    }

    return {
      subject,
      mark,
      obtained,
      percentage,
      gradeRule,
      isPassed,
    };
  });

  const overallPercentage = totalMaxMarks > 0 ? (totalObtainedMarks / totalMaxMarks) * 100 : 0;
  const overallGrade = getGrade(overallPercentage);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/student" className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={exam.name}
          description="Detailed mark sheet"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Max Marks</TableHead>
                    <TableHead className="text-right">Marks Obtained</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjectResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No subjects found for this exam.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subjectResults.map((row) => (
                      <TableRow key={row.subject.id}>
                        <TableCell className="font-medium">{row.subject.name}</TableCell>
                        <TableCell className="text-right">{row.subject.totalMarks}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.mark?.isAbsent ? "Absent" : row.mark?.marksObtained ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.mark?.isAbsent ? "-" : (row.gradeRule?.grade || "-")}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.mark?.isAbsent ? (
                            <Badge variant="destructive">Absent</Badge>
                          ) : row.isPassed ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Pass</Badge>
                          ) : (
                            <Badge variant="destructive">Fail</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-semibold text-lg border-b pb-2">Overall Summary</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Marks</span>
                  <span className="font-semibold">{totalObtainedMarks} / {totalMaxMarks}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Percentage</span>
                  <span className="font-semibold">{overallPercentage.toFixed(2)}%</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Overall Grade</span>
                  <span className="font-semibold text-lg text-primary">{overallGrade?.grade || "-"}</span>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Final Result</span>
                    {hasAbsent ? (
                      <Badge variant="destructive" className="text-sm px-3 py-1">Incomplete</Badge>
                    ) : hasFailingSubject ? (
                      <Badge variant="destructive" className="text-sm px-3 py-1">Failed</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-sm px-3 py-1">Passed</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
