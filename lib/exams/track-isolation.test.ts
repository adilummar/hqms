// Run with a LOCAL scratch database only (refuses anything else):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/exams/track-isolation.test.ts
// The tests create their own data and delete it afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

type Track = "school" | "madrasa" | "hifz";

test("exam subjects are isolated per track", { skip: !isLocal && "needs a local DATABASE_URL" }, async (t) => {
  const { db } = await import("@/lib/db");
  const schema = await import("@/lib/db/schema");
  const { eq, and, inArray } = await import("drizzle-orm");
  const { syncClassSubjects, assertClassesInTrack, findLastExamSubjects } = await import("./subjects-db");
  const { examSessions, examSubjects, examinations, classes, academicYears } = schema;

  const label = `T${Date.now() % 1e9}`;
  const [year] = await db.insert(academicYears).values({
    label, startDate: new Date("2030-06-01"), endDate: new Date("2031-05-31"),
  }).returning();

  const mkClass = async (name: string, track: Track) =>
    (await db.insert(classes).values({ name, track, academicYearId: year.id }).returning())[0];
  const school1 = await mkClass("TS1", "school");
  const school2 = await mkClass("TS2", "school");
  const mad1 = await mkClass("TM1", "madrasa");
  const hz1 = await mkClass("TH1", "hifz");
  const hz2 = await mkClass("TH2", "hifz");

  const mkExam = async (name: string, dates?: Partial<Record<Track, [string, string]>>) => {
    const [exam] = await db.insert(examinations).values({ name, academicYearId: year.id }).returning();
    const sessions = await db.insert(examSessions).values(
      (["school", "madrasa", "hifz"] as Track[]).map((track) => ({
        examinationId: exam.id, name: `${name}-${track}`, track, academicYearId: year.id,
        startDate: dates?.[track]?.[0] ?? null, endDate: dates?.[track]?.[1] ?? null,
      }))
    ).returning();
    return { exam, by: Object.fromEntries(sessions.map((s) => [s.track, s])) as Record<Track, (typeof sessions)[number]> };
  };

  const old = await mkExam(`${label}-old`);
  const cur = await mkExam(`${label}-cur`, {
    school: ["2030-09-01", "2030-09-08"], madrasa: ["2030-09-10", "2030-09-15"], hifz: ["2030-09-20", "2030-09-22"],
  });
  await db.update(examSessions).set({ createdAt: new Date("2020-01-01") }).where(eq(examSessions.examinationId, old.exam.id));

  const subs = (session: string, classId?: string) =>
    db.select().from(examSubjects).where(
      classId ? and(eq(examSubjects.examSessionId, session), eq(examSubjects.classId, classId)) : eq(examSubjects.examSessionId, session)
    ).then((r) => r.map((x) => x.name).sort());
  const save = (session: string, classId: string, names: string[]) =>
    db.transaction((tx) => syncClassSubjects(tx, session, classId, names.map((name) => ({ name, totalMarks: 100, passMarks: 35 }))));

  try {
    await t.test("saving School subjects does not touch Madrasa or Hifz", async () => {
      await save(cur.by.school.id, school1.id, ["Malayalam", "English", "Mathematics"]);
      assert.deepEqual(await subs(cur.by.school.id), ["English", "Malayalam", "Mathematics"]);
      assert.deepEqual(await subs(cur.by.madrasa.id), []);
      assert.deepEqual(await subs(cur.by.hifz.id), []);
    });

    await t.test("Madrasa and Hifz stay independent of each other and of School", async () => {
      await save(cur.by.madrasa.id, mad1.id, ["Arabic", "Quran"]);
      await save(cur.by.hifz.id, hz1.id, ["Sabaq"]);
      assert.deepEqual(await subs(cur.by.school.id), ["English", "Malayalam", "Mathematics"]);
      assert.deepEqual(await subs(cur.by.madrasa.id), ["Arabic", "Quran"]);
      assert.deepEqual(await subs(cur.by.hifz.id), ["Sabaq"]);
    });

    await t.test("a class from another track is rejected for a session", async () => {
      assert.equal((await assertClassesInTrack(cur.by.madrasa.id, [school1.id])).ok, false);
      assert.equal((await assertClassesInTrack(cur.by.school.id, [mad1.id])).ok, false);
      assert.equal((await assertClassesInTrack(cur.by.hifz.id, [hz1.id, school2.id])).ok, false);
      assert.equal((await assertClassesInTrack(cur.by.hifz.id, [hz1.id, hz2.id])).ok, true);
    });

    await t.test("hifz 'apply to all classes' writes every hifz class of that session only", async () => {
      await db.transaction(async (tx) => {
        for (const id of [hz1.id, hz2.id]) await syncClassSubjects(tx, cur.by.hifz.id, id, [{ name: "Sabaq", totalMarks: 100, passMarks: 35 }, { name: "Daura", totalMarks: 100, passMarks: 35 }]);
      });
      assert.deepEqual(await subs(cur.by.hifz.id, hz1.id), ["Daura", "Sabaq"]);
      assert.deepEqual(await subs(cur.by.hifz.id, hz2.id), ["Daura", "Sabaq"]);
      assert.deepEqual(await subs(cur.by.madrasa.id), ["Arabic", "Quran"]);
      assert.deepEqual(await subs(old.by.hifz.id), []);
    });

    await t.test("editing a subject keeps its row id (so entered marks survive); removal deletes only that row", async () => {
      const before = await db.select().from(examSubjects).where(and(eq(examSubjects.examSessionId, cur.by.school.id), eq(examSubjects.classId, school1.id)));
      const eng = before.find((b) => b.name === "English")!;
      await db.transaction((tx) => syncClassSubjects(tx, cur.by.school.id, school1.id, [
        { id: eng.id, name: "English", totalMarks: 50, passMarks: 20, examDate: "2030-09-07" },
        { name: "Malayalam", totalMarks: 100, passMarks: 35 },
      ]));
      const after = await db.select().from(examSubjects).where(and(eq(examSubjects.examSessionId, cur.by.school.id), eq(examSubjects.classId, school1.id)));
      assert.deepEqual(after.map((a) => a.name).sort(), ["English", "Malayalam"]);
      const engAfter = after.find((a) => a.name === "English")!;
      assert.equal(engAfter.id, eng.id);
      assert.equal(engAfter.totalMarks, 50);
      assert.equal(String(engAfter.examDate), "2030-09-07");
      assert.equal(after.find((a) => a.name === "Malayalam")!.id, before.find((b) => b.name === "Malayalam")!.id);
    });

    await t.test("Copy from last exam only reads the same track", async () => {
      await save(old.by.school.id, school1.id, ["OLD-SCHOOL-ONLY"]);
      await save(old.by.madrasa.id, mad1.id, ["OLD-MADRASA-ONLY"]);
      await save(old.by.hifz.id, hz1.id, ["OLD-HIFZ-ONLY"]);
      const names = async (track: Track, classId: string) => (await findLastExamSubjects(cur.by[track], classId)).map((s) => s.name);
      assert.deepEqual(await names("school", school1.id), ["OLD-SCHOOL-ONLY"]);
      assert.deepEqual(await names("madrasa", mad1.id), ["OLD-MADRASA-ONLY"]);
      assert.deepEqual(await names("hifz", hz1.id), ["OLD-HIFZ-ONLY"]);
      // a class with no history in its own track gets nothing — never another track's subjects
      assert.deepEqual(await names("school", school2.id), []);
    });

    await t.test("copy never picks the current exam itself", async () => {
      const own = await findLastExamSubjects(old.by.madrasa, mad1.id);
      assert.deepEqual(own.map((s) => s.name), ["Arabic", "Quran"]); // from the *other* (current) exam, not itself
    });

    await t.test("session dates are independent per track", async () => {
      await db.update(examSessions).set({ startDate: "2031-01-01", endDate: "2031-01-02" }).where(eq(examSessions.id, cur.by.madrasa.id));
      const rows = await db.select().from(examSessions).where(eq(examSessions.examinationId, cur.exam.id));
      const d = Object.fromEntries(rows.map((r) => [r.track, `${r.startDate}→${r.endDate}`]));
      assert.equal(d.school, "2030-09-01→2030-09-08");
      assert.equal(d.madrasa, "2031-01-01→2031-01-02");
      assert.equal(d.hifz, "2030-09-20→2030-09-22");
    });
  } finally {
    const exams = await db.select({ id: examinations.id }).from(examinations).where(eq(examinations.academicYearId, year.id));
    const sess = await db.select({ id: examSessions.id }).from(examSessions).where(inArray(examSessions.examinationId, exams.map((e) => e.id)));
    if (sess.length) await db.delete(examSubjects).where(inArray(examSubjects.examSessionId, sess.map((s) => s.id)));
    if (exams.length) await db.delete(examinations).where(inArray(examinations.id, exams.map((e) => e.id)));
    await db.delete(classes).where(eq(classes.academicYearId, year.id));
    await db.delete(academicYears).where(eq(academicYears.id, year.id));
  }
});

after(() => setTimeout(() => process.exit(0), 100).unref());
