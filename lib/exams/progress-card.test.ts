// Local scratch database only (refuses anything else):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/exams/progress-card.test.ts
// Recreates the production shape that broke the card: the exam, the student's enrolment and the
// class each point at a DIFFERENT academic-year record. Creates its own data and removes it afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

type Track = "school" | "madrasa" | "hifz";

test("progress card reads saved marks per track", { skip: !isLocal && "needs a local DATABASE_URL" }, async (t) => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { buildProgressCardData } = await import("./progress-card");

  const tag = `P${Date.now() % 1e9}`;
  const mkYear = async (label: string, d: string) =>
    (await db.insert(S.academicYears).values({ label: `${tag}${label}`, startDate: new Date(d), endDate: new Date(d) }).returning())[0];
  const examYear = await mkYear("x", "2040-06-01");
  const enrYear = await mkYear("e", "2041-06-01");
  const classYear = await mkYear("c", "2042-06-01");

  const [tutorU] = await db.insert(S.users).values({ username: `${tag}-hifz-tutor`, passwordHash: "x", role: "tutor" }).returning();
  const mkClass = async (name: string, track: Track, tutorId?: string) =>
    (await db.insert(S.classes).values({ name, track, academicYearId: classYear.id, tutorId }).returning())[0];
  const hs1 = await mkClass("PHS1", "school");
  const m4 = await mkClass("PM4", "madrasa");
  const hb = await mkClass("PHB", "hifz", tutorU.id);

  const mkStudent = async (n: number, name: string) =>
    (await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: name, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: enrYear.id,
    } as never).returning())[0];
  const target = await mkStudent(1, "Target");
  const mate = await mkStudent(2, "Mate");
  const unmarked = await mkStudent(3, "Unmarked");
  // enrolments use their own (batch) year, different from both the exam's and the class's
  for (const st of [target, mate, unmarked]) {
    for (const c of [hs1, m4, hb]) await db.insert(S.enrollments).values({ studentId: st.id, classId: c.id, academicYearId: enrYear.id });
  }

  const [exam] = await db.insert(S.examinations).values({ name: `${tag} Exam `, academicYearId: examYear.id, startDate: "2040-09-01", endDate: "2040-09-10" }).returning();
  const sessions = await db.insert(S.examSessions).values([
    { examinationId: exam.id, name: "s", track: "school", academicYearId: examYear.id, resultStatus: "published" },
    { examinationId: exam.id, name: "m", track: "madrasa", academicYearId: examYear.id, resultStatus: "draft" },
    { examinationId: exam.id, name: "h", track: "hifz", academicYearId: examYear.id, resultStatus: "published" },
  ] as never).returning();
  const sess = Object.fromEntries(sessions.map((s) => [s.track, s]));

  const schoolDefs: [string, number][] = [["MALAYALAM ", 5], ["ENGLISH ", 57], ["MATHMATICS ", 75], ["EVS SCIENCE ", 54], ["EVS SOCIAL ", 45], ["HINDI ", 45]];
  const schoolSubs = await db.insert(S.examSubjects).values(
    schoolDefs.map(([name], i) => ({ examSessionId: sess.school.id, classId: hs1.id, name, totalMarks: 100, passMarks: 35, displayOrder: i }))
  ).returning();
  const madSubs = await db.insert(S.examSubjects).values(
    ["LISAN", "FIQH"].map((name, i) => ({ examSessionId: sess.madrasa.id, classId: m4.id, name, totalMarks: 50, passMarks: 20, displayOrder: i }))
  ).returning();

  // Target + mate have school marks; target also has madrasa marks; "unmarked" has none.
  await db.insert(S.examMarks).values(schoolSubs.map((s, i) => ({ examSubjectId: s.id, studentId: target.id, marksObtained: String(schoolDefs[i][1]) })));
  await db.insert(S.examMarks).values(schoolSubs.map((s) => ({ examSubjectId: s.id, studentId: mate.id, marksObtained: "90" })));
  await db.insert(S.examMarks).values(madSubs.map((s) => ({ examSubjectId: s.id, studentId: target.id, marksObtained: "40" })));

  try {
    await t.test("school marks are found despite the exam / enrolment / class year mismatch", async () => {
      const r = await buildProgressCardData(exam.id, target.id);
      assert.ok(r.success);
      const school = r.data.tracks.find((x) => x.track === "school")!;
      assert.ok(school, "school track present");
      assert.deepEqual(
        school.subjects.map((s) => [s.name, s.scored, s.maxMark]),
        schoolDefs.map(([n, v]) => [n.trim(), v, 100])
      );
      assert.equal(school.totalScored, 281);
      assert.equal(school.totalMax, 600);
      assert.equal(school.status, "FAILED"); // Malayalam 5 < 35
      assert.equal(school.className, "PHS1");
      assert.equal(school.rank, 2); // mate scored 540
      assert.equal(r.data.examName, `${tag} Exam`);
      assert.equal(r.data.periodLabel, "SEP 40");
    });

    await t.test("header shows the hifz class and its tutor from the real enrolment", async () => {
      const r = await buildProgressCardData(exam.id, target.id);
      assert.ok(r.success);
      assert.equal(r.data.header.className, "PHB");
      assert.equal(r.data.header.mentor, `${tag}-hifz-tutor`);
      assert.equal(r.data.header.hasHifzClass, true);
    });

    await t.test("tracks are isolated: madrasa has only madrasa subjects, school only school subjects", async () => {
      const r = await buildProgressCardData(exam.id, target.id);
      assert.ok(r.success);
      const mad = r.data.tracks.find((x) => x.track === "madrasa")!;
      const school = r.data.tracks.find((x) => x.track === "school")!;
      assert.deepEqual(mad.subjects.map((s) => s.name), ["LISAN", "FIQH"]);
      assert.equal(mad.className, "PM4");
      assert.ok(school.subjects.every((s) => !["LISAN", "FIQH"].includes(s.name)));
      assert.equal(r.data.tracks.find((x) => x.track === "hifz"), undefined); // no hifz subjects/marks exist
    });

    await t.test("a student with no marks gets a genuine empty card, but still the header", async () => {
      const r = await buildProgressCardData(exam.id, unmarked.id);
      assert.ok(r.success);
      assert.deepEqual(r.data.tracks, []);
      assert.equal(r.data.header.className, "PHB");
    });

    await t.test("parent/student view only shows published tracks (madrasa is draft)", async () => {
      const r = await buildProgressCardData(exam.id, target.id, {}, { publishedOnly: true });
      assert.ok(r.success);
      assert.deepEqual(r.data.tracks.map((x) => x.track), ["school"]);
      const admin = await buildProgressCardData(exam.id, target.id); // admin can still read drafts
      assert.ok(admin.success);
      assert.deepEqual(admin.data.tracks.map((x) => x.track).sort(), ["madrasa", "school"]);
    });

    await t.test("typed teacher names are printed; nothing is invented otherwise", async () => {
      const r = await buildProgressCardData(exam.id, target.id, { schoolTeacher: "Abdul Rasheed", madrasaTeacher: "Irshad" });
      assert.ok(r.success);
      assert.equal(r.data.tracks.find((x) => x.track === "school")!.teacher, "Abdul Rasheed");
      assert.equal(r.data.tracks.find((x) => x.track === "madrasa")!.teacher, "Irshad");
      const plain = await buildProgressCardData(exam.id, target.id);
      assert.ok(plain.success);
      assert.equal(plain.data.tracks.find((x) => x.track === "school")!.teacher, "—"); // class has no tutor
    });

    await t.test("unknown examination / student fail cleanly", async () => {
      const zero = "00000000-0000-0000-0000-000000000000";
      assert.equal((await buildProgressCardData(zero, target.id)).success, false);
      assert.equal((await buildProgressCardData(exam.id, zero)).success, false);
    });

    await t.test("building a card changes no marks", async () => {
      const before = await db.select().from(S.examMarks).where(inArray(S.examMarks.studentId, [target.id, mate.id]));
      await buildProgressCardData(exam.id, target.id);
      const after = await db.select().from(S.examMarks).where(inArray(S.examMarks.studentId, [target.id, mate.id]));
      assert.equal(after.length, before.length);
      assert.deepEqual(after.map((m) => `${m.id}:${m.marksObtained}`).sort(), before.map((m) => `${m.id}:${m.marksObtained}`).sort());
    });
  } finally {
    const studentIds = [target.id, mate.id, unmarked.id];
    await db.delete(S.examMarks).where(inArray(S.examMarks.studentId, studentIds));
    await db.delete(S.examinations).where(eq(S.examinations.id, exam.id)); // cascades sessions + subjects
    await db.delete(S.enrollments).where(inArray(S.enrollments.studentId, studentIds));
    await db.delete(S.students).where(inArray(S.students.id, studentIds));
    await db.delete(S.classes).where(inArray(S.classes.id, [hs1.id, m4.id, hb.id]));
    await db.delete(S.users).where(eq(S.users.id, tutorU.id));
    await db.delete(S.academicYears).where(inArray(S.academicYears.id, [examYear.id, enrYear.id, classYear.id]));
  }
});

after(() => setTimeout(() => process.exit(0), 100).unref());
