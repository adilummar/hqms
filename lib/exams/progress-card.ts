// Builds the data for the printed progress card. Plain server-side module (NOT a
// Server Action file) so it cannot be called directly from the browser; pages that
// import it do their own authorisation first.
import { db } from "@/lib/db";
import { examinations, examMarks, examSubjects, students, enrollments, juzTracker } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

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
  status: "PASS" | "FAILED";
  subjects: CardSubject[];
  totalMax: number;
  totalScored: number;
  /** hifz only */
  memorizedJuz?: string;
  /** hifz only */
  toBeObtained?: string;
}

export interface ProgressCardData {
  examName: string;
  /** e.g. "MAR 26" */
  periodLabel: string;
  studentName: string;
  admissionNumber: string;
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

const round2 = (n: number) => Math.round(n * 100) / 100;

function periodLabel(start: string | null, end: string | null, fallback: string) {
  const d = end ?? start;
  const m = d?.match(/^(\d{4})-(\d{2})/);
  if (!m) return fallback.toUpperCase();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[Number(m[2]) - 1]} ${m[1].slice(2)}`;
}

export async function buildProgressCardData(
  examinationId: string,
  studentId: string,
  overrides: ProgressCardOverrides = {}
): Promise<{ success: true; data: ProgressCardData } | { success: false; error: string }> {
  const exam = await db.query.examinations.findFirst({
    where: eq(examinations.id, examinationId),
    with: { examSessions: { with: { subjects: true } } },
  });
  if (!exam) return { success: false, error: "Examination not found" };

  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  if (!student) return { success: false, error: "Student not found" };

  const studentEnrollments = await db.query.enrollments.findMany({
    where: and(eq(enrollments.studentId, studentId), eq(enrollments.academicYearId, exam.academicYearId)),
    with: { class: { with: { tutor: true } } },
  });

  const completedJuz = await db
    .select({ n: juzTracker.juzNumber })
    .from(juzTracker)
    .where(and(eq(juzTracker.studentId, studentId), eq(juzTracker.status, "completed")));

  const order: CardTrack[] = ["hifz", "madrasa", "school"];
  const tracks: CardTrackData[] = [];

  for (const track of order) {
    const session = exam.examSessions.find((s) => s.track === track);
    if (!session) continue;
    const enrolledClass = studentEnrollments.find((e) => e.class.track === track)?.class;
    // Subjects belong to a class: without an enrolment there is nothing to show for this track.
    if (!enrolledClass) continue;
    const subjects = session.subjects
      .filter((s) => s.classId === enrolledClass.id)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    if (subjects.length === 0) continue;

    // Marks of every classmate in this session → totals → rank.
    const classmates = await db
      .select({ id: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.classId, enrolledClass.id), eq(enrollments.academicYearId, exam.academicYearId)));
    const classmateIds = classmates.map((c) => c.id);
    const subjectIds = subjects.map((s) => s.id);
    const allMarks = classmateIds.length
      ? await db
          .select()
          .from(examMarks)
          .where(and(inArray(examMarks.examSubjectId, subjectIds), inArray(examMarks.studentId, classmateIds)))
      : [];

    const totals = new Map<string, number>();
    for (const m of allMarks) {
      const v = m.isAbsent ? 0 : Number(m.marksObtained ?? 0);
      totals.set(m.studentId, (totals.get(m.studentId) ?? 0) + v);
    }

    const mine = allMarks.filter((m) => m.studentId === studentId);
    let totalMax = 0;
    let totalScored = 0;
    let allPassed = true;
    const cardSubjects: CardSubject[] = subjects.map((subject) => {
      const mark = mine.find((m) => m.examSubjectId === subject.id);
      const scored = mark?.isAbsent ? 0 : Number(mark?.marksObtained ?? 0);
      totalMax += subject.totalMarks;
      totalScored += scored;
      if (!mark || mark.isAbsent || mark.marksObtained === null || scored < subject.passMarks) allPassed = false;
      return { name: subject.name, maxMark: subject.totalMarks, scored: mark?.isAbsent ? "AB" : round2(scored) };
    });

    const myTotal = totals.get(studentId);
    const rank = myTotal === undefined ? null : 1 + [...totals.values()].filter((t) => t > myTotal).length;

    const defaultTeacher = enrolledClass.tutor?.username ?? "";
    const teacher =
      (track === "hifz" ? overrides.mentor : track === "madrasa" ? overrides.madrasaTeacher : overrides.schoolTeacher)?.trim() ||
      defaultTeacher ||
      "—";

    tracks.push({
      track,
      className: enrolledClass.name,
      teacher,
      rank,
      status: allPassed ? "PASS" : "FAILED",
      subjects: cardSubjects,
      totalMax,
      totalScored: round2(totalScored),
      ...(track === "hifz"
        ? {
            memorizedJuz: overrides.memorizedJuz?.trim() || String(completedJuz.length),
            toBeObtained: overrides.toBeObtained?.trim() || "—",
          }
        : {}),
    });
  }

  return {
    success: true,
    data: {
      examName: exam.name,
      periodLabel: periodLabel(exam.startDate, exam.endDate, exam.name),
      studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
      admissionNumber: student.admissionNumber ?? student.studentCode,
      tracks,
    },
  };
}
