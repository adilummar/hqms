// Parent-facing exam results. Plain server-side module (NOT a Server Action file).
// Only tracks (exam_sessions) whose resultStatus is "published" are ever read; an
// unpublished track's subjects/marks are never queried. Callers must pass the studentId
// of the logged-in parent's own child (getParentStudentId). This module never builds the
// internal progress card.
import { db } from "@/lib/db";
import { examinations, examMarks, enrollments } from "@/lib/db/schema";
import { getHifzResults } from "@/lib/exams/hifz-results";
import { and, eq, inArray } from "drizzle-orm";

export type ResultTrack = "hifz" | "madrasa" | "school";

export interface ParentResultSubject {
  name: string;
  maxMark: number;
  scored: number | "AB" | null;
  passed: boolean;
}

export interface ParentTrackResult {
  track: ResultTrack;
  subjects: ParentResultSubject[];
  totalMax: number;
  totalScored: number;
  hifz?: { memorizedJuz: string | null; toBeObtained: string | null; remarks: string | null };
}

export interface ParentExamResult {
  examName: string;
  tracks: ParentTrackResult[];
}

const TRACK_ORDER: ResultTrack[] = ["school", "madrasa", "hifz"];

/** Examinations that have at least one published track the student has subjects in. */
export async function listPublishedExamsForStudent(studentId: string) {
  const enr = await db.query.enrollments.findMany({ where: eq(enrollments.studentId, studentId) });
  const classIds = [...new Set(enr.map((e) => e.classId))];
  if (classIds.length === 0) return [];

  const exams = await db.query.examinations.findMany({
    with: { examSessions: { with: { subjects: true } } },
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });
  return exams.filter((ex) =>
    ex.examSessions.some(
      (s) => s.resultStatus === "published" && s.subjects.some((sub) => classIds.includes(sub.classId))
    )
  );
}

export async function getPublishedResultsForStudent(
  examinationId: string,
  studentId: string
): Promise<ParentExamResult | null> {
  const exam = await db.query.examinations.findFirst({
    where: eq(examinations.id, examinationId),
    with: { examSessions: { with: { subjects: true } } },
  });
  if (!exam) return null;

  const enr = await db.query.enrollments.findMany({ where: eq(enrollments.studentId, studentId) });
  const classIds = new Set(enr.map((e) => e.classId));

  // Publication gate: unpublished sessions are dropped before any marks are read.
  const published = exam.examSessions.filter((s) => s.resultStatus === "published");

  const tracks: ParentTrackResult[] = [];
  for (const track of TRACK_ORDER) {
    const session = published.find((s) => s.track === track);
    if (!session) continue;

    const mine = session.subjects.filter((s) => classIds.has(s.classId));
    const subjectIds = mine.map((s) => s.id);
    const marks = subjectIds.length
      ? await db
          .select()
          .from(examMarks)
          .where(and(eq(examMarks.studentId, studentId), inArray(examMarks.examSubjectId, subjectIds)))
      : [];
    const byId = new Map(marks.map((m) => [m.examSubjectId, m]));

    // Only the class in which the student actually has marks for this track.
    const classId = mine.find((s) => byId.has(s.id))?.classId;
    const subjects = mine
      .filter((s) => s.classId === classId)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    let totalMax = 0;
    let totalScored = 0;
    const rows: ParentResultSubject[] = subjects.map((s) => {
      const m = byId.get(s.id);
      const scored = m?.isAbsent ? 0 : Number(m?.marksObtained ?? 0);
      totalMax += s.totalMarks;
      totalScored += scored;
      return {
        name: s.name.trim(),
        maxMark: s.totalMarks,
        scored: m?.isAbsent ? "AB" : m?.marksObtained == null ? null : scored,
        passed: !!m && !m.isAbsent && m.marksObtained !== null && scored >= s.passMarks,
      };
    });

    let hifz: ParentTrackResult["hifz"];
    if (track === "hifz") {
      const stored = (await getHifzResults(session.id, [studentId])).rows[0];
      const f = (n: number | null | undefined) => (n == null ? null : String(n));
      if (stored) {
        hifz = {
          memorizedJuz: f(stored.juzMemorized),
          toBeObtained: f(stored.juzToObtain),
          remarks: stored.remarks?.trim() || null,
        };
      }
    }

    if (rows.length === 0 && !hifz) continue;
    tracks.push({ track, subjects: rows, totalMax, totalScored: Math.round(totalScored * 100) / 100, hifz });
  }

  return { examName: exam.name.trim(), tracks };
}
