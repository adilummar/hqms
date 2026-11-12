// DB tests need a local scratch DB (refuses anything else):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/exams/progress-card-bulk.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardFileStem, uniqueName, juzDisplay } from "./progress-card-view";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

test("file names: admission no + name, sanitised and unique", () => {
  assert.equal(cardFileStem("211", "Ahammed Nuhman"), "211-Ahammed-Nuhman");
  assert.equal(cardFileStem("A/1", "Abdul:Basith*?"), "A-1-Abdul-Basith");
  assert.equal(cardFileStem("", ""), "progress-card");
  const used = new Set<string>();
  assert.deepEqual([uniqueName("a", used), uniqueName("a", used), uniqueName("A", used)], ["a", "a-2", "A-3"]);
});

test("Juz display adds the unit to numbers only", () => {
  assert.equal(juzDisplay("2"), "2 Juz");
  assert.equal(juzDisplay("1.25"), "1.25 Juz");
  assert.equal(juzDisplay(null), null);
  assert.equal(juzDisplay("Good"), "Good");
});

test("bulk actions are admin-only and class-scoped; parent code never reaches them", () => {
  const actions = readFileSync("lib/actions/progress-cards-bulk.ts", "utf8");
  for (const fn of ["getBulkProgressCardRoster", "renderClassProgressCards", "renderSingleProgressCard"]) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}`));
    assert.match(body.slice(0, 200), /await requireAdmin\(\)/, fn);
  }
  assert.match(actions, /verifyClassInExam/); // class must really take part in the exam
  assert.match(actions, /Student is not in this class/); // students re-checked against the class server-side
  assert.match(readFileSync("app/(dashboard)/admin/progress-cards/bulk/page.tsx", "utf8"), /requireAdmin\(\)/);
});

test("system Juz values, bulk == individual, Juz 29/30 denominators", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { buildProgressCardData, buildProgressCardsBatch } = await import("./progress-card");

  const tag = `PB${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const [tutor] = await db.insert(S.users).values({ username: `${tag}-t`, passwordHash: "x", role: "tutor" } as never).returning();
  const mkClass = async (name: string, track: "hifz" | "school") =>
    (await db.insert(S.classes).values({ name, track, academicYearId: year.id, tutorId: tutor.id }).returning())[0];
  const hifzCls = await mkClass(`${tag}HA`, "hifz");
  const otherCls = await mkClass(`${tag}HB`, "hifz");
  const schoolCls = await mkClass(`${tag}S5`, "school");

  const mkStudent = async (n: number, classes: (typeof hifzCls)[]) => {
    const [st] = await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: `s${n}`, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning();
    for (const c of classes) await db.insert(S.enrollments).values({ studentId: st.id, classId: c.id, academicYearId: year.id });
    return st;
  };
  const a = await mkStudent(1, [hifzCls, schoolCls]);   // normal Juz, target set
  const b = await mkStudent(2, [hifzCls]);              // Juz 29 → 24-page denominator
  const c = await mkStudent(3, [hifzCls]);              // no target, no entries → unavailable
  const d = await mkStudent(4, [hifzCls]);              // typed + stored precedence
  const other = await mkStudent(5, [otherCls]);         // different class

  const [exam] = await db.insert(S.examinations).values({ name: `${tag}-E`, academicYearId: year.id, startDate: "2050-09-01", endDate: "2050-09-10" }).returning();
  const [hifzSess] = await db.insert(S.examSessions).values({ examinationId: exam.id, name: `${tag}h`, track: "hifz", academicYearId: year.id }).returning();
  const [schoolSess] = await db.insert(S.examSessions).values({ examinationId: exam.id, name: `${tag}s`, track: "school", academicYearId: year.id }).returning();
  const hs = (await db.insert(S.examSubjects).values({ examSessionId: hifzSess.id, classId: hifzCls.id, name: "HIFZ", totalMarks: 100, passMarks: 35 }).returning())[0];
  const hs2 = (await db.insert(S.examSubjects).values({ examSessionId: hifzSess.id, classId: otherCls.id, name: "HIFZ", totalMarks: 100, passMarks: 35 }).returning())[0];
  const ss = (await db.insert(S.examSubjects).values({ examSessionId: schoolSess.id, classId: schoolCls.id, name: "ENGLISH", totalMarks: 100, passMarks: 35 }).returning())[0];
  for (const [st, sub, v] of [[a, hs, "80"], [b, hs, "70"], [c, hs, "60"], [d, hs, "50"], [other, hs2, "90"], [a, ss, "75"]] as const)
    await db.insert(S.examMarks).values({ examSubjectId: sub.id, studentId: st.id, marksObtained: v });

  const e = (studentId: string, date: string, extra: object) => ({ studentId, date, recordedBy: tutor.id, ...extra });
  await db.insert(S.studentAnnualHifzTargets).values([
    { studentId: a.id, academicYearId: year.id, targetJuzAmount: "2", startingJuzNumber: 1, startingPage: 1, calculatedTotalPages: 40 },
    { studentId: b.id, academicYearId: year.id, targetJuzAmount: "1.5", startingJuzNumber: 29, startingPage: 1, calculatedTotalPages: 36, isManualOverride: true },
    { studentId: d.id, academicYearId: year.id, targetJuzAmount: "1", startingJuzNumber: 1, startingPage: 1, calculatedTotalPages: 20 },
  ]);
  await db.insert(S.hifzDailyEntries).values([
    // a: 15 pages in Juz 5 (20-page) → 0.75 Juz. Revision-only entries add nothing.
    e(a.id, "2050-07-01", { sabaqPages: "10", sabaqJuzNumber: 5 }),
    e(a.id, "2050-08-01", { sabaqPages: "5", sabaqJuzNumber: 5 }),
    e(a.id, "2050-08-02", { dauraJuzNumbers: [1, 2, 3], sabaqJuzGiven: true }),
    e(a.id, "2050-09-20", { sabaqPages: "50", sabaqJuzNumber: 5 }),       // after the exam end: not counted
    e(a.id, "2050-05-31", { sabaqPages: "50", sabaqJuzNumber: 5 }),       // before the academic year: not counted
    // b: 10 pages in Juz 29 → 10/24 = 0.42 Juz (NOT half a Juz)
    e(b.id, "2050-07-05", { sabaqPages: "10", sabaqJuzNumber: 29 }),
    e(d.id, "2050-07-05", { sabaqPages: "20", sabaqJuzNumber: 1 }),
  ]);
  await db.insert(S.examHifzResults).values({ examSessionId: hifzSess.id, studentId: d.id, juzToObtain: "3", juzMemorized: "2.5" });

  try {
    const ids = [a.id, b.id, c.id, d.id];
    const batch = await buildProgressCardsBatch(exam.id, ids);

    const hifz = (id: string) => {
      const r = batch.get(id)!;
      assert.ok(r.success);
      return r.data.tracks.find((t) => t.track === "hifz")!;
    };

    // a: target from the Hifz target system; memorized from Sabaq pages only (15/20 = 0.75)
    assert.equal(hifz(a.id).toBeObtained, "2");
    assert.equal(hifz(a.id).memorizedJuz, "0.75");
    assert.deepEqual(hifz(a.id).juzSource, { toBeObtained: "system", memorized: "system" });

    // b: manual override target respected; Juz 29 uses 24 pages → 10/24, never 0.5
    assert.equal(hifz(b.id).toBeObtained, "1.5");
    assert.equal(hifz(b.id).memorizedJuz, "0.42");

    // c: nothing to base a value on → unavailable, not 0
    assert.equal(hifz(c.id).toBeObtained, null);
    assert.equal(hifz(c.id).memorizedJuz, null);

    // d: the exam-specific stored value wins over the system value
    assert.equal(hifz(d.id).toBeObtained, "3");
    assert.equal(hifz(d.id).memorizedJuz, "2.5");
    assert.deepEqual(hifz(d.id).juzSource, { toBeObtained: "stored", memorized: "stored" });

    // typed-for-this-print wins over everything
    const typed = await buildProgressCardData(exam.id, d.id, { toBeObtained: "4", memorizedJuz: "1" });
    assert.ok(typed.success);
    assert.equal(typed.data.tracks.find((t) => t.track === "hifz")!.toBeObtained, "4");

    // Bulk and Individual produce IDENTICAL data for every student (incl. rank, school marks)
    for (const id of ids) {
      const single = await buildProgressCardData(exam.id, id);
      assert.deepEqual(batch.get(id), single, `student ${id}`);
    }
    // School section is untouched by the Hifz Juz additions
    const aSchool = (batch.get(a.id) as { success: true; data: { tracks: { track: string; subjects: { scored: number | string }[] }[] } }).data.tracks.find((t) => t.track === "school")!;
    assert.equal(aSchool.subjects[0].scored, 75);

    // A student of another class never leaks into this class's cards
    const only = await buildProgressCardsBatch(exam.id, [a.id]);
    assert.equal(only.size, 1);
    assert.equal(only.has(other.id), false);
    // Unknown exam / student fail cleanly instead of throwing
    const bad = await buildProgressCardsBatch("00000000-0000-4000-8000-000000000000", [a.id]);
    assert.equal(bad.get(a.id)!.success, false);
  } finally {
    const ids = [a.id, b.id, c.id, d.id, other.id];
    await db.delete(S.examinations).where(eq(S.examinations.id, exam.id));
    await db.delete(S.hifzDailyEntries).where(inArray(S.hifzDailyEntries.studentId, ids));
    await db.delete(S.studentAnnualHifzTargets).where(inArray(S.studentAnnualHifzTargets.studentId, ids));
    await db.delete(S.enrollments).where(inArray(S.enrollments.studentId, ids));
    await db.delete(S.students).where(inArray(S.students.id, ids));
    for (const cl of [hifzCls, otherCls, schoolCls]) await db.delete(S.classes).where(eq(S.classes.id, cl.id));
    await db.delete(S.users).where(eq(S.users.id, tutor.id));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
