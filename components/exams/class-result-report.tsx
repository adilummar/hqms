import { db } from "@/lib/db";
import { examSessions, classes, examSubjects, examMarks, examGradeRules, enrollments } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

export async function ClassResultReport({
  examSessionId,
  classId,
}: {
  examSessionId: string;
  classId: string;
}) {
  const exam = await db.query.examSessions.findFirst({
    where: eq(examSessions.id, examSessionId),
  });

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
  });

  if (!exam || !cls) return <div>Invalid exam or class</div>;

  // Subjects
  const subjects = await db.query.examSubjects.findMany({
    where: and(
      eq(examSubjects.examSessionId, examSessionId),
      eq(examSubjects.classId, classId)
    ),
    orderBy: [asc(examSubjects.displayOrder)],
  });

  if (subjects.length === 0) return <div>No subjects found for this class.</div>;

  // Students
  const classEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.classId, classId),
      eq(enrollments.status, "active"),
      eq(enrollments.academicYearId, exam.academicYearId)
    ),
    with: { student: true },
  });
  
  const students = classEnrollments.map(e => e.student);

  // Marks
  const subjectIds = subjects.map(s => s.id);
  const studentIds = students.map(s => s.id);

  let marks: typeof examMarks.$inferSelect[] = [];
  if (subjectIds.length > 0 && studentIds.length > 0) {
    marks = await db.query.examMarks.findMany({
      where: and(
        inArray(examMarks.examSubjectId, subjectIds),
        inArray(examMarks.studentId, studentIds)
      ),
    });
  }

  // Grade rules
  const gradeRules = await db.query.examGradeRules.findMany({
    where: eq(examGradeRules.examSessionId, examSessionId),
  });
  const sortedRules = [...gradeRules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));

  const getGrade = (percentage: number) => {
    for (const rule of sortedRules) {
      if (percentage >= Number(rule.minPercentage)) return rule;
    }
    return null;
  };

  // Calculate results
  const totalMaxMarks = subjects.reduce((sum, s) => sum + s.totalMarks, 0);

  const studentResults = students.map((student) => {
    let totalObtained = 0;
    let hasAbsent = false;
    let hasFailingSubject = false;

    const subjectMarks = subjects.map(sub => {
      const mark = marks.find(m => m.studentId === student.id && m.examSubjectId === sub.id);
      const obtained = mark && !mark.isAbsent && mark.marksObtained ? Number(mark.marksObtained) : 0;
      
      if (mark?.isAbsent) hasAbsent = true;
      else totalObtained += obtained;

      const isPassed = !mark?.isAbsent && obtained >= sub.passMarks;
      if (!isPassed) hasFailingSubject = true;

      return { subjectId: sub.id, obtained, isAbsent: mark?.isAbsent };
    });

    const percentage = totalMaxMarks > 0 ? (totalObtained / totalMaxMarks) * 100 : 0;
    const grade = getGrade(percentage);
    
    let resultStatus: "passed" | "failed" | "incomplete" = "passed";
    if (hasAbsent) resultStatus = "incomplete";
    else if (hasFailingSubject) resultStatus = "failed";

    return {
      student,
      subjectMarks,
      totalObtained,
      percentage,
      grade,
      resultStatus,
    };
  });

  // Sort by total marks descending (Ranking)
  studentResults.sort((a, b) => b.totalObtained - a.totalObtained);

  return (
    <div className="rounded-md border bg-card overflow-x-auto">
      <Table className="w-full text-sm">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-12 text-center">Rank</TableHead>
            <TableHead>Student</TableHead>
            {subjects.map(sub => (
              <TableHead key={sub.id} className="text-center">{sub.name}</TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">%</TableHead>
            <TableHead className="text-center">Grade</TableHead>
            <TableHead className="text-center">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {studentResults.map((row, index) => (
            <TableRow key={row.student.id} className="hover:bg-muted/30">
              <TableCell className="text-center font-medium">
                {row.resultStatus === "passed" ? (
                  index < 3 ? <Trophy className={`inline-block w-4 h-4 ${index === 0 ? "text-amber-400" : index === 1 ? "text-slate-400" : "text-amber-700"}`} /> : index + 1
                ) : "-"}
              </TableCell>
              <TableCell className="font-medium whitespace-nowrap">
                {row.student.firstName} {row.student.lastName}
              </TableCell>
              {subjects.map(sub => {
                const sMark = row.subjectMarks.find(sm => sm.subjectId === sub.id);
                return (
                  <TableCell key={sub.id} className="text-center">
                    {sMark?.isAbsent ? "Abs" : sMark?.obtained ?? "-"}
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-semibold">{row.totalObtained}</TableCell>
              <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
              <TableCell className="text-center font-medium text-primary">{row.grade?.grade || "-"}</TableCell>
              <TableCell className="text-center">
                {row.resultStatus === "passed" && <Badge className="bg-green-600">Pass</Badge>}
                {row.resultStatus === "failed" && <Badge variant="destructive">Fail</Badge>}
                {row.resultStatus === "incomplete" && <Badge variant="outline">Inc</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
