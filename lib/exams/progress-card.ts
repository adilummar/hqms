// Builds the data for the progress card (screen/print, PDF and bulk download all use this ONE
// service). Plain server-side module (NOT a Server Action file) so it cannot be called directly
// from the browser; callers do their own authorisation first.
//
// Relationship followed (same one the mark-entry screen uses):
//   examinations.id  →  exam_sessions (one per track)  →  exam_subjects (per class)
//                    →  exam_marks (per student)
// The student's class for a track is the class that has subjects in that track's session
// and that the student has marks in. We deliberately do NOT compare
// enrolments.academic_year_id with the exam's academic year: enrolments carry their own
// (batch) year records that do not line up with the exam's year, which made the card empty.
//
// buildProgressCardsBatch loads everything for many students in a fixed number of queries
// (no per-student query storm); buildProgressCardData is the single-student wrapper, so a card
// is byte-for-byte the same whether opened on its own or generated in bulk.
import { db } from "@/lib/db";
import {
  examinations, examMarks, students, enrollments, classes, academicYears,
  studentAnnualHifzTargets, hifzDailyEntries,
} from "@/lib/db/schema";
import { getHifzResults, type HifzResultRow } from "@/lib/exams/hifz-results";
import { aggregateStudyToJuz } from "@/lib/utils/juz-calculator";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

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
  /** hifz only — null = not available */
  memorizedJuz?: string | null;
  /** hifz only — null = not available */
  toBeObtained?: string | null;
  /** hifz only — where each Juz value came from (typed for this print / stored for this exam / the Hifz target+progress system) */
  juzSource?: { toBeObtained: JuzSource; memorized: JuzSource };
  /** hifz only — result remark(s) if any */
  remarks?: string | null;
}

export type JuzSource = "typed" | "stored" | "system" | null;

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

export type ProgressCardResult = { success: true; data: ProgressCardData } | { success: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const trimName = (n: string) => n.trim();

/** "2", "1.25" — never a long float tail. */
export function formatJuzAmount(n: number): string {
  return String(Number(n.toFixed(2)));
}

function periodLabel(start: string | null, end: string | null, fallback: string) {
  const d = end ?? start;
  const m = d?.match(/^(\d{4})-(\d{2})/);
  if (!m) return fallback.trim().toUpperCase();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[Number(m[2]) - 1]} ${m[1].slice(2)}`;
}

const dateStr = (d: Date) => d.toISOString().split("T")[0];

/**
 * Hifz Juz values from the existing Hifz systems (never invented):
 *  - Juz to be Obtained = the student's annual Hifz target for the examination's academic year
 *    (student_annual_hifz_targets.target_juz_amount — already reflects manual overrides).
 *  - Juz Memorized = Sabaq pages recorded from the academic-year start up to the exam end date,
 *    converted with the same Juz-equivalent utility the reports use (Juz 1–28 = 20 pages,
 *    Juz 29/30 = 24). Sabaq Juz and Daura are revision and are not counted.
 * null = cannot be determined reliably (no target row / no Sabaq entries).
 */
async function loadSystemJuz(
  exam: { academicYearId: string; startDate: string | null; endDate: string | null },
  studentIds: string[]
): Promise<Map<string, { target: string | null; memorized: string | null }>> {
  const out = new Map<string, { target: string | null; memorized: string | null }>();
  for (const id of studentIds) out.set(id, { target: null, memorized: null });
  if (studentIds.length === 0) return out;

  const [year] = await db.select().from(academicYears).where(eq(academicYears.id, exam.academicYearId));
  const [targets, entries] = await Promise.all([
    db
      .select()
      .from(studentAnnualHifzTargets)
      .where(and(inArray(studentAnnualHifzTargets.studentId, studentIds), eq(studentAnnualHifzTargets.academicYearId, exam.academicYearId))),
    year
      ? db
          .select({ studentId: hifzDailyEntries.studentId, pages: hifzDailyEntries.sabaqPages, juz: hifzDailyEntries.sabaqJuzNumber })
          .from(hifzDailyEntries)
          .where(
            and(
              inArray(hifzDailyEntries.studentId, studentIds),
              gte(hifzDailyEntries.date, dateStr(year.startDate)),
              // Pinned to the exam's end (else start, else today) so a reprint later gives the same card
              lte(hifzDailyEntries.date, exam.endDate ?? exam.startDate ?? dateStr(new Date())),
              sql`${hifzDailyEntries.sabaqPages} > 0`
            )
          )
      : Promise.resolve([] as { studentId: string; pages: string | null; juz: number | null }[]),
  ]);

  for (const t of targets) out.get(t.studentId)!.target = formatJuzAmount(Number(t.targetJuzAmount));
  const byStudent = new Map<string, { pages: number; juzNumber: number | null }[]>();
  for (const e of entries) {
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push({ pages: parseFloat(e.pages as string), juzNumber: e.juz });
    byStudent.set(e.studentId, arr);
  }
  for (const [id, list] of byStudent) out.get(id)!.memorized = formatJuzAmount(aggregateStudyToJuz(list));
  return out;
}

export async function buildProgressCardsBatch(
  examinationId: string,
  studentIds: string[],
  overrides: ProgressCardOverrides = {},
  options: ProgressCardOptions = {}
): Promise<Map<string, ProgressCardResult>> {
  const results = new Map<string, ProgressCardResult>();
  const ids = [...new Set(studentIds)];
  const fail = (error: string) => {
    for (const id of ids) results.set(id, { success: false, error });
    return results;
  };
  if (ids.length === 0) return results;

  const exam = await db.query.examinations.findFirst({
    where: eq(examinations.id, examinationId),
    with: { examSessions: { with: { subjects: true } } },
  });
  if (!exam) return fail("Examination not found");

  const studentRows = await db.select().from(students).where(inArray(students.id, ids));
  const studentById = new Map(studentRows.map((s) => [s.id, s]));

  // All enrolments (no academic-year filter), newest first per student, active ones preferred
  const allEnrollments = await db.query.enrollments.findMany({
    where: inArray(enrollments.studentId, ids),
    with: { class: { with: { tutor: true } } },
    orderBy: [desc(enrollments.enrolledAt)],
  });
  const enrollByStudent = new Map<string, typeof allEnrollments>();
  for (const e of allEnrollments) {
    const arr = enrollByStudent.get(e.studentId) ?? [];
    arr.push(e);
    enrollByStudent.set(e.studentId, arr);
  }
  for (const arr of enrollByStudent.values()) arr.sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));

  // Every mark these students have in this examination (all tracks), keyed by student → subject
  const allSubjectIds = exam.examSessions.flatMap((s) => s.subjects.map((x) => x.id));
  const markRows = allSubjectIds.length
    ? await db.select().from(examMarks).where(and(inArray(examMarks.studentId, ids), inArray(examMarks.examSubjectId, allSubjectIds)))
    : [];
  const marksByStudent = new Map<string, Map<string, (typeof markRows)[number]>>();
  for (const m of markRows) {
    const inner = marksByStudent.get(m.studentId) ?? new Map();
    inner.set(m.examSubjectId, m);
    marksByStudent.set(m.studentId, inner);
  }

  // Which class each student is ranked in, per track, decided up front so classmates load in one pass
  const hifzSession = exam.examSessions.find((s) => s.track === "hifz");
  const hifzStored = new Map<string, HifzResultRow>();
  if (hifzSession) for (const r of (await getHifzResults(hifzSession.id, ids)).rows) hifzStored.set(r.studentId, r);

  const classIdFor = (studentId: string, session: (typeof exam.examSessions)[number]) =>
    session.subjects.find((s) => marksByStudent.get(studentId)?.has(s.id))?.classId;

  // Ranking data: marks of the class's ACTIVE classmates (plus every requested student) per class
  const rankClassIds = new Set<string>();
  for (const id of ids) for (const session of exam.examSessions) {
    const c = classIdFor(id, session);
    if (c && session.subjects.some((s) => s.classId === c)) rankClassIds.add(c);
  }
  const activeByClass = new Map<string, Set<string>>();
  if (rankClassIds.size > 0) {
    const act = await db
      .select({ classId: enrollments.classId, studentId: enrollments.studentId })
      .from(enrollments)
      .where(and(inArray(enrollments.classId, [...rankClassIds]), eq(enrollments.status, "active")));
    for (const a of act) {
      const set = activeByClass.get(a.classId) ?? new Set();
      set.add(a.studentId);
      activeByClass.set(a.classId, set);
    }
  }
  const rankPool = new Set<string>(ids);
  for (const set of activeByClass.values()) for (const s of set) rankPool.add(s);
  const poolMarks = allSubjectIds.length && rankClassIds.size > 0
    ? await db.select().from(examMarks).where(and(inArray(examMarks.examSubjectId, allSubjectIds), inArray(examMarks.studentId, [...rankPool])))
    : [];
  const poolBySubjectStudent = new Map<string, number>(); // `${subjectId}|${studentId}` → value
  const poolStudentsWithRows = new Map<string, Set<string>>(); // subjectId → students that have a row
  for (const m of poolMarks) {
    poolBySubjectStudent.set(`${m.examSubjectId}|${m.studentId}`, m.isAbsent ? 0 : Number(m.marksObtained ?? 0));
    const set = poolStudentsWithRows.get(m.examSubjectId) ?? new Set();
    set.add(m.studentId);
    poolStudentsWithRows.set(m.examSubjectId, set);
  }
  /** Total over the class's subjects for one student, undefined when they have no mark row at all (→ no rank). */
  const totalFor = (subjectIds: string[], studentId: string) => {
    let any = false;
    let t = 0;
    for (const sid of subjectIds) {
      const v = poolBySubjectStudent.get(`${sid}|${studentId}`);
      if (v !== undefined) { any = true; t += v; }
    }
    return any ? t : undefined;
  };

  const systemJuz = hifzSession ? await loadSystemJuz(exam, ids) : new Map<string, { target: string | null; memorized: string | null }>();

  const classCache = new Map<string, Awaited<ReturnType<typeof db.query.classes.findFirst>>>();
  const order: CardTrack[] = ["hifz", "madrasa", "school"];

  for (const studentId of ids) {
    const student = studentById.get(studentId);
    if (!student) { results.set(studentId, { success: false, error: "Student not found" }); continue; }

    const studentEnrollments = enrollByStudent.get(studentId) ?? [];
    const marksBySubject = marksByStudent.get(studentId) ?? new Map();

    // Header: the student's Hifz class + its tutor (independent of whether hifz has exam subjects).
    const hifzEnrollment = studentEnrollments.find((e) => e.class.track === "hifz");
    const mentorName = overrides.mentor?.trim() || hifzEnrollment?.class.tutor?.username?.trim() || "";

    const tracks: CardTrackData[] = [];

    for (const track of order) {
      const session = exam.examSessions.find((s) => s.track === track);
      if (!session) continue;
      if (options.publishedOnly && session.resultStatus !== "published") continue;

      // Exam-specific Hifz values are stored per (hifz session, student).
      const stored = track === "hifz" ? hifzStored.get(studentId) : undefined;

      // The class is the one the student has marks in for THIS session. A track with no marks
      // entered for the student is left off the card (shown as an empty state), never as zeros —
      // except Hifz, which may exist with only its Juz values recorded.
      const classIdFromMarks = classIdFor(studentId, session);
      let classRow = classIdFromMarks
        ? studentEnrollments.find((e) => e.classId === classIdFromMarks)?.class
        : stored
          ? hifzEnrollment?.class
          : undefined;
      if (!classRow && classIdFromMarks) {
        if (!classCache.has(classIdFromMarks))
          classCache.set(classIdFromMarks, await db.query.classes.findFirst({ where: eq(classes.id, classIdFromMarks), with: { tutor: true } }));
        classRow = classCache.get(classIdFromMarks) as typeof classRow;
      }
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
        const subjectIds = subjects.map((s) => s.id);
        const classmateIds = new Set([...(activeByClass.get(classIdFromMarks) ?? []), studentId]);
        const totals: number[] = [];
        for (const id of classmateIds) {
          const t = totalFor(subjectIds, id);
          if (t !== undefined) totals.push(t);
        }
        const myTotal = totalFor(subjectIds, studentId);
        rank = myTotal === undefined ? null : 1 + totals.filter((t) => t > myTotal).length;
      }

      const teacher =
        (track === "hifz" ? mentorName : track === "madrasa" ? overrides.madrasaTeacher : overrides.schoolTeacher)?.trim() ||
        classRow.tutor?.username?.trim() ||
        "—";

      let hifzExtras: Pick<CardTrackData, "memorizedJuz" | "toBeObtained" | "remarks" | "juzSource"> | undefined;
      if (track === "hifz") {
        const fromStore = (n: number | null | undefined) => (n === null || n === undefined ? null : String(n));
        // Remarks: the Hifz result's own remark plus any remark entered on the student's Hifz marks.
        const markRemarks = subjects
          .map((s) => marksBySubject.get(s.id)?.remarks?.trim())
          .filter((r): r is string => !!r);
        const remarks = [...new Set([stored?.remarks?.trim(), ...markRemarks].filter((r): r is string => !!r))].join("; ");

        // Priority: typed for this print → stored for this exam → Hifz target / progress system → unavailable
        const sys = systemJuz.get(studentId) ?? { target: null, memorized: null };
        const pick = (typed: string | undefined, store: string | null, system: string | null): [string | null, JuzSource] => {
          if (typed?.trim()) return [typed.trim(), "typed"];
          if (store !== null) return [store, "stored"];
          if (system !== null) return [system, "system"];
          return [null, null];
        };
        const [toBeObtained, toSrc] = pick(overrides.toBeObtained, fromStore(stored?.juzToObtain), sys.target);
        const [memorizedJuz, memSrc] = pick(overrides.memorizedJuz, fromStore(stored?.juzMemorized), sys.memorized);
        hifzExtras = { toBeObtained, memorizedJuz, juzSource: { toBeObtained: toSrc, memorized: memSrc }, remarks: remarks || null };
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

    results.set(studentId, {
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
    });
  }
  return results;
}

export async function buildProgressCardData(
  examinationId: string,
  studentId: string,
  overrides: ProgressCardOverrides = {},
  options: ProgressCardOptions = {}
): Promise<ProgressCardResult> {
  const res = await buildProgressCardsBatch(examinationId, [studentId], overrides, options);
  return res.get(studentId) ?? { success: false, error: "Student not found" };
}
