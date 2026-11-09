// Local scratch database only (refuses anything else):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/exams/progress-card-tracks.test.ts
// Needs migration 0010 (exam_hifz_results) applied to that scratch DB. Creates and removes its own data.
import { test, after } from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

type Track = "school" | "madrasa" | "hifz";

test("progress card: all tracks, Hifz Juz values, isolation", { skip: !isLocal && "needs a local DATABASE_URL" }, async (t) => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { buildProgressCardData } = await import("./progress-card");
  const { saveHifzResults, getHifzResults } = await import("./hifz-results");

  const tag = `T${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const [tutor] = await db.insert(S.users).values({ username: `${tag}-tutor`, passwordHash: "x", role: "tutor" }).returning();
  const [admin] = await db.insert(S.users).values({ username: `${tag}-admin`, passwordHash: "x", role: "admin" }).returning();
  const mkClass = async (name: string, track: Track, tutorId?: string) =>
    (await db.insert(S.classes).values({ name, track, academicYearId: year.id, tutorId }).returning())[0];
  const cls: Record<Track, typeof S.classes.$inferSelect> = {
    school: await mkClass("TS", "school"),
    madrasa: await mkClass("TM", "madrasa"),
    hifz: await mkClass("TH", "hifz", tutor.id),
  };

  // Students: which tracks each one has marks in
  const plan: Record<string, Track[]> = {
    onlySchool: ["school"], onlyMadrasa: ["madrasa"], onlyHifz: ["hifz"],
    schoolMadrasa: ["school", "madrasa"], schoolHifz: ["school", "hifz"], madrasaHifz: ["madrasa", "hifz"],
    all: ["school", "madrasa", "hifz"], none: [],
  };
  const stu: Record<string, typeof S.students.$inferSelect> = {};
  let n = 0;
  for (const name of Object.keys(plan)) {
    n++;
    const [st] = await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: name, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning();
    stu[name] = st;
    for (const c of Object.values(cls)) await db.insert(S.enrollments).values({ studentId: st.id, classId: c.id, academicYearId: year.id });
  }

  // Two examinations. E1: every track published. E2: hifz still draft (used for Juz entry + lock tests).
  const mkExam = async (name: string, hifzStatus: "published" | "draft") => {
    const [exam] = await db.insert(S.examinations).values({ name, academicYearId: year.id, startDate: "2050-09-01", endDate: "2050-09-10" }).returning();
    const sessions = await db.insert(S.examSessions).values(
      (["school", "madrasa", "hifz"] as Track[]).map((track) => ({
        examinationId: exam.id, name: `${name}-${track}`, track, academicYearId: year.id,
        resultStatus: track === "hifz" ? hifzStatus : "published",
      }))
    ).returning();
    const by = Object.fromEntries(sessions.map((s) => [s.track, s])) as Record<Track, (typeof sessions)[number]>;
    const subjects: Record<Track, (typeof S.examSubjects.$inferSelect)[]> = { school: [], madrasa: [], hifz: [] };
    const names: Record<Track, string[]> = { school: ["ENGLISH", "MATHS"], madrasa: ["FIQH", "LISAN"], hifz: ["HIFZ", "QIRATH"] };
    for (const track of ["school", "madrasa", "hifz"] as Track[]) {
      subjects[track] = await db.insert(S.examSubjects).values(
        names[track].map((nm, i) => ({ examSessionId: by[track].id, classId: cls[track].id, name: `${track}-${nm}`, totalMarks: 100, passMarks: 35, displayOrder: i }))
      ).returning();
    }
    return { exam, by, subjects };
  };
  const E1 = await mkExam(`${tag}-E1`, "published");
  const E2 = await mkExam(`${tag}-E2`, "draft");

  // Distinct, traceable marks: value = base(exam, student, track) + subject index
  const baseOf = (e: 1 | 2, student: string, track: Track) =>
    (e === 1 ? 10 : 12) + Object.keys(plan).indexOf(student) * 3 + ["school", "madrasa", "hifz"].indexOf(track) * 25;
  const expected = (e: 1 | 2, student: string, track: Track) => [0, 1].map((i) => baseOf(e, student, track) + i);
  for (const [e, E] of [[1, E1], [2, E2]] as const) {
    for (const [student, tracks] of Object.entries(plan)) {
      for (const track of tracks) {
        await db.insert(S.examMarks).values(
          E.subjects[track].map((sub, i) => ({ examSubjectId: sub.id, studentId: stu[student].id, marksObtained: String(expected(e, student, track)[i]) }))
        );
      }
    }
  }

  const trackKeys = async (e: 1 | 2, student: string) => {
    const r = await buildProgressCardData((e === 1 ? E1 : E2).exam.id, stu[student].id);
    assert.ok(r.success);
    return r.data;
  };
  const allSubjectNames = ["ENGLISH", "MATHS", "FIQH", "LISAN", "HIFZ", "QIRATH"];

  try {
    // 1-7: every combination of tracks, with values traced back to the exact student / exam / track
    for (const [student, tracks] of Object.entries(plan).filter(([k]) => k !== "none")) {
      await t.test(`student with ${tracks.join(" + ")} results (${student})`, async () => {
        const d = await trackKeys(1, student);
        assert.deepEqual(d.tracks.map((x) => x.track).sort(), [...tracks].sort());
        for (const track of tracks) {
          const section = d.tracks.find((x) => x.track === track)!;
          assert.deepEqual(section.subjects.map((s) => s.scored), expected(1, student, track));
          // subject isolation: only this track's subjects
          assert.ok(section.subjects.every((s) => s.name.startsWith(`${track}-`)), "no foreign subjects");
          assert.equal(section.className, cls[track].name);
          assert.equal(section.totalMax, 200);
        }
      });
    }

    // 8
    await t.test("student with no examination results gets no sections but a correct header", async () => {
      const d = await trackKeys(1, "none");
      assert.deepEqual(d.tracks, []);
      assert.equal(d.studentName, "none");
      assert.equal(d.header.className, "TH");
      assert.equal(d.header.mentor, `${tag}-tutor`);
    });

    // 13 / 12: examinations and students never mix
    await t.test("different examinations never mix", async () => {
      const a = await trackKeys(1, "all");
      const b = await trackKeys(2, "all");
      for (const track of ["school", "madrasa", "hifz"] as Track[]) {
        assert.deepEqual(a.tracks.find((x) => x.track === track)!.subjects.map((s) => s.scored), expected(1, "all", track));
        assert.deepEqual(b.tracks.find((x) => x.track === track)!.subjects.map((s) => s.scored), expected(2, "all", track));
      }
    });

    await t.test("different students never mix (every student's card only holds its own marks)", async () => {
      const seen = new Map<number, string>();
      for (const student of Object.keys(plan)) {
        const d = await trackKeys(1, student);
        for (const sec of d.tracks) for (const s of sec.subjects) {
          const v = s.scored as number;
          assert.ok(expected(1, student, sec.track).includes(v), `${student} ${sec.track} has foreign mark ${v}`);
          if (seen.has(v)) assert.fail(`mark ${v} appears on two students: ${seen.get(v)} and ${student}`);
          seen.set(v, student);
        }
      }
    });

    // 11: published readable
    await t.test("published results remain readable in the published-only (parent) view", async () => {
      const r = await buildProgressCardData(E1.exam.id, stu.all.id, {}, { publishedOnly: true });
      assert.ok(r.success);
      assert.deepEqual(r.data.tracks.map((x) => x.track).sort(), ["hifz", "madrasa", "school"]);
      // E2's hifz is a draft: hidden from parents, visible to admin
      const p2 = await buildProgressCardData(E2.exam.id, stu.all.id, {}, { publishedOnly: true });
      assert.ok(p2.success);
      assert.deepEqual(p2.data.tracks.map((x) => x.track).sort(), ["madrasa", "school"]);
      assert.deepEqual((await trackKeys(2, "all")).tracks.map((x) => x.track).sort(), ["hifz", "madrasa", "school"]);
    });

    // 10: historical hifz exam without Juz values → "not recorded", not zero
    await t.test("historical Hifz result without Juz values reports them as not recorded (null), never 0", async () => {
      const hifz = (await trackKeys(1, "all")).tracks.find((x) => x.track === "hifz")!;
      assert.equal(hifz.toBeObtained, null);
      assert.equal(hifz.memorizedJuz, null);
      assert.equal(hifz.remarks, null);
    });

    // 9: Juz values stored per student + hifz session, shown on the card
    await t.test("Juz values are stored for the Hifz exam and appear on that student's card only", async () => {
      const res = await saveHifzResults(E2.by.hifz.id, [
        { studentId: stu.all.id, juzToObtain: 22, juzMemorized: 19.5, remarks: "Needs revision" },
      ], admin.id);
      assert.ok(res.success);
      const mine = (await trackKeys(2, "all")).tracks.find((x) => x.track === "hifz")!;
      assert.equal(mine.toBeObtained, "22");
      assert.equal(mine.memorizedJuz, "19.5");
      assert.equal(mine.remarks, "Needs revision");
      // another student of the same exam: nothing recorded
      const other = (await trackKeys(2, "onlyHifz")).tracks.find((x) => x.track === "hifz")!;
      assert.equal(other.toBeObtained, null);
      // same student, other examination: nothing leaks across exams
      const e1 = (await trackKeys(1, "all")).tracks.find((x) => x.track === "hifz")!;
      assert.equal(e1.toBeObtained, null);
      // daily Hifz progress is never used: give the student completed Juz and confirm nothing changes
      await db.insert(S.juzTracker).values({ studentId: stu.onlyHifz.id, juzNumber: 5, status: "completed" });
      assert.equal(((await trackKeys(2, "onlyHifz")).tracks.find((x) => x.track === "hifz")!).memorizedJuz, null);
      await db.delete(S.juzTracker).where(eq(S.juzTracker.studentId, stu.onlyHifz.id));
    });

    await t.test("a student with only Juz values (no Hifz marks yet) still gets a clear Hifz section", async () => {
      const r = await saveHifzResults(E2.by.hifz.id, [{ studentId: stu.none.id, juzToObtain: 15, juzMemorized: null, remarks: null }], admin.id);
      assert.ok(r.success);
      const hifz = (await trackKeys(2, "none")).tracks.find((x) => x.track === "hifz")!;
      assert.ok(hifz);
      assert.equal(hifz.toBeObtained, "15");
      assert.equal(hifz.memorizedJuz, null);
      assert.deepEqual(hifz.subjects, []);
      assert.equal(hifz.status, "—");
      assert.equal(hifz.rank, null);
    });

    await t.test("typed override (published/locked print) wins for that card without touching stored values", async () => {
      const r = await buildProgressCardData(E1.exam.id, stu.all.id, { toBeObtained: "22", memorizedJuz: "19" });
      assert.ok(r.success);
      const hifz = r.data.tracks.find((x) => x.track === "hifz")!;
      assert.equal(hifz.toBeObtained, "22");
      assert.equal(hifz.memorizedJuz, "19");
      assert.equal((await getHifzResults(E1.by.hifz.id, [stu.all.id])).rows.length, 0);
    });

    await t.test("Juz entry: validation", async () => {
      const bad = async (juzToObtain: number | null, juzMemorized: number | null) =>
        saveHifzResults(E2.by.hifz.id, [{ studentId: stu.all.id, juzToObtain, juzMemorized, remarks: null }], admin.id);
      assert.equal((await bad(31, null)).success, false);
      assert.equal((await bad(-1, null)).success, false);
      assert.equal((await bad(null, 19.3)).success, false);
      assert.equal((await bad(22, 19.5)).success, true);
      assert.deepEqual((await getHifzResults(E2.by.hifz.id, [stu.all.id])).rows[0].juzToObtain, 22);
    });

    await t.test("Juz entry only works for Hifz sessions", async () => {
      const r = await saveHifzResults(E2.by.school.id, [{ studentId: stu.all.id, juzToObtain: 1, juzMemorized: 1, remarks: null }], admin.id);
      assert.equal(r.success, false);
    });

    await t.test("published-results lock: Juz values cannot be changed on a published Hifz exam", async () => {
      const r = await saveHifzResults(E1.by.hifz.id, [{ studentId: stu.all.id, juzToObtain: 30, juzMemorized: 30, remarks: null }], admin.id);
      assert.equal(r.success, false);
      assert.equal((await getHifzResults(E1.by.hifz.id, [stu.all.id])).rows.length, 0);
    });

    await t.test("clearing every Juz field removes the record (back to 'not recorded')", async () => {
      const r = await saveHifzResults(E2.by.hifz.id, [{ studentId: stu.none.id, juzToObtain: null, juzMemorized: null, remarks: null }], admin.id);
      assert.ok(r.success);
      assert.equal((await getHifzResults(E2.by.hifz.id, [stu.none.id])).rows.length, 0);
      assert.deepEqual((await trackKeys(2, "none")).tracks, []);
    });

    await t.test("marks are untouched by saving Juz values", async () => {
      const before = await db.select().from(S.examMarks).where(inArray(S.examMarks.studentId, Object.values(stu).map((s) => s.id)));
      await saveHifzResults(E2.by.hifz.id, [{ studentId: stu.all.id, juzToObtain: 20, juzMemorized: 18, remarks: null }], admin.id);
      const after = await db.select().from(S.examMarks).where(inArray(S.examMarks.studentId, Object.values(stu).map((s) => s.id)));
      assert.deepEqual(after.map((m) => `${m.id}:${m.marksObtained}`).sort(), before.map((m) => `${m.id}:${m.marksObtained}`).sort());
    });

    await t.test("track-specific subject isolation stays intact", async () => {
      const d = await trackKeys(1, "all");
      const names = d.tracks.flatMap((x) => x.subjects.map((s) => `${x.track}:${s.name}`));
      for (const nm of names) {
        const [track, subject] = nm.split(":");
        assert.ok(subject.startsWith(`${track}-`), `${nm} is on the wrong track`);
      }
      assert.equal(names.length, 6);
      assert.ok(allSubjectNames.length === 6);
    });
  } finally {
    const ids = Object.values(stu).map((s) => s.id);
    await db.delete(S.examMarks).where(inArray(S.examMarks.studentId, ids));
    await db.delete(S.examinations).where(inArray(S.examinations.id, [E1.exam.id, E2.exam.id])); // cascades sessions, subjects, hifz results
    await db.delete(S.enrollments).where(inArray(S.enrollments.studentId, ids));
    await db.delete(S.students).where(inArray(S.students.id, ids));
    await db.delete(S.classes).where(inArray(S.classes.id, Object.values(cls).map((c) => c.id)));
    await db.delete(S.users).where(inArray(S.users.id, [tutor.id, admin.id]));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});

after(() => setTimeout(() => process.exit(0), 100).unref());
