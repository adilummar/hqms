// Mark-entry progress per track session. Expected marks = active students in each subject's
// class; entered = marks (or absences) recorded for those students. Counts are strictly
// per session, never combined across tracks. Plain module.
import { db } from "@/lib/db";
import { examSubjects, examMarks, enrollments } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface SessionProgress {
  subjects: number;
  expected: number;
  entered: number;
  missing: number;
}

export const EMPTY_PROGRESS: SessionProgress = { subjects: 0, expected: 0, entered: 0, missing: 0 };

/** Pure aggregation (unit-tested). */
export function summarizeProgress(
  subjects: { id: string; sessionId: string; classId: string }[],
  activeByClass: Map<string, number>,
  enteredBySubject: Map<string, number>
): Map<string, SessionProgress> {
  const out = new Map<string, SessionProgress>();
  for (const s of subjects) {
    const p = out.get(s.sessionId) ?? { ...EMPTY_PROGRESS };
    const expected = activeByClass.get(s.classId) ?? 0;
    const entered = Math.min(enteredBySubject.get(s.id) ?? 0, expected);
    p.subjects += 1;
    p.expected += expected;
    p.entered += entered;
    p.missing += expected - entered;
    out.set(s.sessionId, p);
  }
  return out;
}

export async function getSessionProgress(sessionIds: string[]): Promise<Map<string, SessionProgress>> {
  if (sessionIds.length === 0) return new Map();
  const subjects = await db
    .select({ id: examSubjects.id, sessionId: examSubjects.examSessionId, classId: examSubjects.classId })
    .from(examSubjects)
    .where(inArray(examSubjects.examSessionId, sessionIds));
  if (subjects.length === 0) return new Map();

  const classIds = [...new Set(subjects.map((s) => s.classId))];
  const subjectIds = subjects.map((s) => s.id);

  const [active, entered] = await Promise.all([
    db
      .select({ classId: enrollments.classId, n: sql<number>`count(distinct ${enrollments.studentId})::int` })
      .from(enrollments)
      .where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, "active")))
      .groupBy(enrollments.classId),
    db
      .select({ subjectId: examMarks.examSubjectId, n: sql<number>`count(*)::int` })
      .from(examMarks)
      .innerJoin(examSubjects, eq(examSubjects.id, examMarks.examSubjectId))
      .innerJoin(
        enrollments,
        and(
          eq(enrollments.classId, examSubjects.classId),
          eq(enrollments.studentId, examMarks.studentId),
          eq(enrollments.status, "active")
        )
      )
      .where(
        and(
          inArray(examMarks.examSubjectId, subjectIds),
          sql`(${examMarks.marksObtained} is not null or ${examMarks.isAbsent})`
        )
      )
      .groupBy(examMarks.examSubjectId),
  ]);

  return summarizeProgress(
    subjects,
    new Map(active.map((a) => [a.classId, a.n])),
    new Map(entered.map((e) => [e.subjectId, e.n]))
  );
}
