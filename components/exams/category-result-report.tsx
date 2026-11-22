import { db } from "@/lib/db";
import { examSessions, classes, examSubjects, examMarks, examGradeRules, enrollments, students } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { enrollmentStudentIsActive } from "@/lib/students/active";

import { rankDescending, yearCategoryOf, type YearCategoryKey } from "@/lib/exams/year-category";

/**
 * Ranking for one year category (Sub-Junior / Junior / Senior) across every class of ONE exam
 * session (= one track). Students are pooled by the year of study on their active enrolment, so
 * the 1st-year students of HA, HB and HC are ranked against each other. Because classes may have
 * different subject sets, the ranking is by percentage of each class's total maximum.
 */
export async function CategoryResultReport({
  examSessionId,
  category,
}: {
  examSessionId: string;
  category: YearCategoryKey;
}) {
  const session = await db.query.examSessions.findFirst({ where: eq(examSessions.id, examSessionId) });
  if (!session) return <div>Invalid exam</div>;

  const subjects = await db.select().from(examSubjects).where(eq(examSubjects.examSessionId, examSessionId));
  const classIds = [...new Set(subjects.map((s) => s.classId))];
  if (classIds.length === 0) return <Empty text="No subjects are configured for this exam yet." />;

  const sessionClasses = (await db.select().from(classes).where(inArray(classes.id, classIds))).filter((c) => c.track === session.track);
  const classById = new Map(sessionClasses.map((c) => [c.id, c]));

  const enrolled = await db
    .select({ studentId: enrollments.studentId, classId: enrollments.classId, yearOfStudy: enrollments.yearOfStudy, first: students.firstName, last: students.lastName })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(
      inArray(enrollments.classId, [...classById.keys()]),
      eq(enrollments.status, "active"),
      eq(enrollments.academicYearId, session.academicYearId),
      enrollmentStudentIsActive()
    ));
  const pool = enrolled.filter((e) => yearCategoryOf(e.yearOfStudy) === category);
  if (pool.length === 0) return <Empty text="No active students in this category." />;

  const marks = await db
    .select()
    .from(examMarks)
    .where(and(inArray(examMarks.examSubjectId, subjects.map((s) => s.id)), inArray(examMarks.studentId, pool.map((p) => p.studentId))));

  const rules = (await db.select().from(examGradeRules).where(eq(examGradeRules.examSessionId, examSessionId)))
    .sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));
  const gradeOf = (pct: number) => rules.find((r) => pct >= Number(r.minPercentage))?.grade ?? "-";

  const rows = pool.map((p) => {
    const subs = subjects.filter((s) => s.classId === p.classId);
    const max = subs.reduce((t, s) => t + s.totalMarks, 0);
    let total = 0, absent = false, failing = false, entered = false;
    for (const s of subs) {
      const m = marks.find((x) => x.studentId === p.studentId && x.examSubjectId === s.id);
      if (m) entered = true;
      const v = m && !m.isAbsent && m.marksObtained ? Number(m.marksObtained) : 0;
      if (m?.isAbsent) absent = true; else total += v;
      if (!m || m.isAbsent || v < s.passMarks) failing = true;
    }
    const pct = max > 0 ? (total / max) * 100 : 0;
    const status: "passed" | "failed" | "incomplete" = absent ? "incomplete" : failing ? "failed" : "passed";
    return { ...p, className: classById.get(p.classId)?.name ?? "—", total, max, pct, status, entered };
  });

  // Same rule as the class ranking: only students who passed every subject are ranked
  const ranked = rows.filter((r) => r.status === "passed").sort((a, b) => b.pct - a.pct);
  const ranks = rankDescending(ranked, (x) => x.pct);
  const rankOf = new Map(ranked.map((r, i) => [r.studentId, ranks[i]]));
  const display = [...ranked, ...rows.filter((r) => r.status !== "passed").sort((a, b) => b.pct - a.pct)];

  return (
    <div className="rounded-md border bg-card overflow-x-auto">
      <Table className="w-full text-sm">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-12 text-center">Rank</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Class</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Max</TableHead>
            <TableHead className="text-right">%</TableHead>
            <TableHead className="text-center">Grade</TableHead>
            <TableHead className="text-center">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {display.map((r) => {
            const rank = rankOf.get(r.studentId);
            return (
              <TableRow key={r.studentId} className="hover:bg-muted/30">
                <TableCell className="text-center font-medium">
                  {rank === undefined ? "-" : rank <= 3
                    ? <Trophy className={`inline-block w-4 h-4 ${rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-400" : "text-amber-700"}`} />
                    : rank}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{r.first} {r.last}</TableCell>
                <TableCell>{r.className}</TableCell>
                <TableCell className="text-right font-semibold">{r.entered ? r.total : "-"}</TableCell>
                <TableCell className="text-right">{r.max}</TableCell>
                <TableCell className="text-right">{r.entered ? `${r.pct.toFixed(1)}%` : "-"}</TableCell>
                <TableCell className="text-center font-medium text-primary">{r.entered ? gradeOf(r.pct) : "-"}</TableCell>
                <TableCell className="text-center">
                  {r.status === "passed" && <Badge className="bg-green-600">Pass</Badge>}
                  {r.status === "failed" && <Badge variant="destructive">Fail</Badge>}
                  {r.status === "incomplete" && <Badge variant="outline">Inc</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">{text}</div>;
}
