// Builds the data for the printed progress card. Plain server-side module (NOT a
// Server Action file) so it cannot be called directly from the browser; pages that
// import it do their own authorisation first.
//
// Relationship followed (same one the mark-entry screen uses):
//   examinations.id  →  exam_sessions (one per track)  →  exam_subjects (per class)
//                    →  exam_marks (per student)
// The student's class for a track is the class that has subjects in that track's session
// and that the student has marks in. We deliberately do NOT compare
// enrolments.academic_year_id with the exam's academic year: enrolments carry their own
// (batch) year records that do not line up with the exam's year, which made the card empty.
import { db } from "@/lib/db";
import { examinations, examMarks, students, enrollments, classes } from "@/lib/db/schema";
import { getHifzResults } from "@/lib/exams/hifz-results";
import { and, desc, eq, inArray } from "drizzle-orm";

export type CardTrack = "hifz" | "madrasa" | "school";

export interface CardSubject {
  name: string;
  maxMark: number;
  /** number, or "AB" when absent */
  scored: number | "AB";
}

export interface CardTrackData {
  track: CardTrack;
  className: string;
  /** Class teacher (madrasa/school) or mentor (hifz) */
  teacher: string;
  rank: number | null;
  /** "—" when the track has no marks to judge (Hifz with only Juz values recorded) */
  status: "PASS" | "FAILED" | "—";
  subjects: CardSubject[];
  totalMax: number;
  totalScored: number;
  /** hifz only — null = not recorded for this exam */
  memorizedJuz?: string | null;
  /** hifz only — null = not recorded for this exam */
  toBeObtained?: string | null;
  /** hifz only — result remark(s) if any */
  remarks?: string | null;
}

export interface ProgressCardData {
  examName: string;
  /** e.g. "MAR 26" */
  periodLabel: string;
  studentName: string;
  admissionNumber: string;
  /** Student's Hifz class and its tutor (the "Class" / "Mentor" lines). "—" when none exists. */
  header: { className: string; mentor: string; hasHifzClass: boolean };
  tracks: CardTrackData[];
}

/** Values the admin types in just before generating a card. */
export interface ProgressCardOverrides {
  toBeObtained?: string;
  memorizedJuz?: string;
  mentor?: string;
  madrasaTeacher?: string;
  schoolTeacher?: string;
}

export interface ProgressCardOptions {
  /** Only include tracks whose results are published (use for parent / student views). */
  publishedOnly?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const trimName = (n: string) => n.trim();

function periodLabel(start: string | null, end: string | null, fallback: string) {
  const d = end ?? start;
  const m = d?.match(/^(\d{4})-(\d{2})/);
  if (!m) return fallback.trim().toUpperCase();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[Number(m[2]) - 1]} ${m[1].slice(2)}`;
}

export async function buildProgressCardData(
  examinationId: string,
  studentId: string,
  overrides: ProgressCardOverrides = {},
  options: ProgressCardOptions = {}
): Promise<{ success: true; data: ProgressCardData } | { success: false; error: string }> {
  const exam = await db.query.examinations.findFirst({
    where: eq(examinations.id, examinationId),
    with: { examSessions: { with: { subjects: true } } },
  });
  if (!exam) return { success: false, error: "Examination not found" };

  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  if (!student) return { success: false, error: "Student not found" };

  // All of the student's enrolments, newest first, active ones preferred (no academic-year filter).
  const studentEnrollments = (
    await db.query.enrollments.findMany({
      where: eq(enrollments.studentId, studentId),
      with: { class: { with: { tutor: true } } },
      orderBy: [desc(enrollments.enrolledAt)],
    })
  ).sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));

  // Every mark this student has in this examination (all tracks), keyed by subject.
  const allSubjectIds = exam.examSessions.flatMap((s) => s.subjects.map((x) => x.id));
  const myMarks = allSubjectIds.length
    ? await db
        .select()
        .from(examMarks)
        .where(and(eq(examMarks.studentId, studentId), inArray(examMarks.examSubjectId, allSubjectIds)))
    : [];
  const marksBySubject = new Map(myMarks.map((m) => [m.examSubjectId, m]));

  // Header: the student's Hifz class + its tutor (independent of whether hifz has exam subjects).
  const hifzEnrollment = studentEnrollments.find((e) => e.class.track === "hifz");
  const mentorName =
    overrides.mentor?.trim() || hifzEnrollment?.class.tutor?.username?.trim() || "";

  const order: CardTrack[] = ["hifz", "madrasa", "school"];
  const tracks: CardTrackData[] = [];

  for (const track of order) {
    const session = exam.examSessions.find((s) => s.track === track);
    if (!session) continue;
    if (options.publishedOnly && session.resultStatus !== "published") continue;

    // Exam-specific Hifz values are stored per (hifz session, student) — never derived from daily progress.
    const stored = track === "hifz" ? (await getHifzResults(session.id, [studentId])).rows[0] : undefined;

    // The class is the one the student has marks in for THIS session. A track with no marks
    // entered for the student is left off the card (shown as an empty state), never as zeros —
    // except Hifz, which may exist with only its Juz values recorded.
    const classIdFromMarks = session.subjects.find((s) => marksBySubject.has(s.id))?.classId;
    const classRow = classIdFromMarks
      ? studentEnrollments.find((e) => e.classId === classIdFromMarks)?.class ??
        (await db.query.classes.findFirst({ where: eq(classes.id, classIdFromMarks), with: { tutor: true } }))
      : stored
        ? hifzEnrollment?.class
        : undefined;
    if (!classRow) continue;
    // Never mix tracks: a class must belong to the track being rendered.
    if (classRow.track !== track) continue;

    const subjects = classIdFromMarks
      ? session.subjects
          .filter((s) => s.classId === classIdFromMarks)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      : [];

    let totalMax = 0;
    let totalScored = 0;
    let allPassed = true;
    let rank: number | null = null;
    const cardSubjects: CardSubject[] = subjects.map((subject) => {
      const mark = marksBySubject.get(subject.id);
      const scored = mark?.isAbsent ? 0 : Number(mark?.marksObtained ?? 0);
      totalMax += subject.totalMarks;
      totalScored += scored;
      if (!mark || mark.isAbsent || mark.marksObtained === null || scored < subject.passMarks) allPassed = false;
      return { name: trimName(subject.name), maxMark: subject.totalMarks, scored: mark?.isAbsent ? "AB" : round2(scored) };
    });

    if (subjects.length > 0 && classIdFromMarks) {
      // Classmates (active, same class — same rule as the mark-entry screen) + this student → ranks.
      const classmates = await db
        .select({ id: enrollments.studentId })
        .from(enrollments)
        .where(and(eq(enrollments.classId, classIdFromMarks), eq(enrollments.status, "active")));
      const classmateIds = [...new Set([...classmates.map((c) => c.id), studentId])];
      const classMarks = await db
        .select()
        .from(examMarks)
        .where(and(inArray(examMarks.examSubjectId, subjects.map((s) => s.id)), inArray(examMarks.studentId, classmateIds)));
      const totals = new Map<string, number>();
      for (const m of classMarks) {
        const v = m.isAbsent ? 0 : Number(m.marksObtained ?? 0);
        totals.set(m.studentId, (totals.get(m.studentId) ?? 0) + v);
      }
      const myTotal = totals.get(studentId);
      rank = myTotal === undefined ? null : 1 + [...totals.values()].filter((t) => t > myTotal).length;
    }

    const teacher =
      (track === "hifz" ? mentorName : track === "madrasa" ? overrides.madrasaTeacher : overrides.schoolTeacher)?.trim() ||
      classRow.tutor?.username?.trim() ||
      "—";

    let hifzExtras: Pick<CardTrackData, "memorizedJuz" | "toBeObtained" | "remarks"> | undefined;
    if (track === "hifz") {
      const fromStore = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));
      // Remarks: the Hifz result's own remark plus any remark entered on the student's Hifz marks.
      const markRemarks = subjects
        .map((s) => marksBySubject.get(s.id)?.remarks?.trim())
        .filter((r): r is string => !!r);
      const remarks = [...new Set([stored?.remarks?.trim(), ...markRemarks].filter((r): r is string => !!r))].join("; ");
      hifzExtras = {
        toBeObtained: overrides.toBeObtained?.trim() || fromStore(stored?.juzToObtain),
        memorizedJuz: overrides.memorizedJuz?.trim() || fromStore(stored?.juzMemorized),
        remarks: remarks || null,
      };
    }

    tracks.push({
      track,
      className: classRow.name,
      teacher,
      rank,
      status: subjects.length === 0 ? "—" : allPassed ? "PASS" : "FAILED",
      subjects: cardSubjects,
      totalMax,
      totalScored: round2(totalScored),
      ...(hifzExtras ?? {}),
    });
  }

  return {
    success: true,
    data: {
      examName: exam.name.trim(),
      periodLabel: periodLabel(exam.startDate, exam.endDate, exam.name),
      studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
      admissionNumber: student.admissionNumber ?? student.studentCode,
      header: {
        className: hifzEnrollment?.class.name ?? tracks[0]?.className ?? "—",
        mentor: mentorName || "—",
        hasHifzClass: !!hifzEnrollment,
      },
      tracks,
    },
  };
}
