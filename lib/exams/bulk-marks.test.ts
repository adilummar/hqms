// Pure tests run anywhere. DB tests need a local scratch DB (refuses anything else):
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/exams/bulk-marks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMarkText, displayMark, isChangedRow, rowStatus } from "./bulk-marks-validate";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

test("validation: max, negative, decimals, empty, zero", () => {
  assert.equal(validateMarkText("", 100), null);
  assert.equal(validateMarkText("0", 100), null);
  assert.equal(validateMarkText("100", 100), null);
  assert.equal(validateMarkText("100.01", 100) !== null, true);
  assert.equal(validateMarkText("101", 100) !== null, true);
  assert.equal(validateMarkText("-1", 100) !== null, true);
  assert.equal(validateMarkText("12.345", 100) !== null, true);
  assert.equal(validateMarkText("12.5", 100), null);
  assert.equal(validateMarkText("abc", 100) !== null, true);
  assert.equal(displayMark("77.00"), "77");
  assert.equal(displayMark("0.00"), "0"); // explicit zero stays a value
  assert.equal(displayMark(null), "");
});

test("changed-row rules: untouched, cleared, explicit zero, absent", () => {
  const o = { value: "50", absent: false };
  assert.equal(isChangedRow(o, { value: "50", absent: false }, 100), false); // untouched
  assert.equal(isChangedRow(o, { value: "50.0", absent: false }, 100), false); // same number
  assert.equal(isChangedRow(o, { value: "", absent: false }, 100), false); // clearing is never a change
  assert.equal(isChangedRow(o, { value: "60", absent: false }, 100), true);
  assert.equal(isChangedRow(o, { value: "150", absent: false }, 100), false); // invalid → not submittable
  assert.equal(isChangedRow(null, { value: "0", absent: false }, 100), true); // explicit zero is a mark
  assert.equal(isChangedRow(null, { value: "", absent: false }, 100), false);
  assert.equal(isChangedRow(null, { value: "", absent: true }, 100), true);
  assert.equal(rowStatus(null, { value: "", absent: false }, 100), "not_entered");
  assert.equal(rowStatus(o, { value: "50", absent: false }, 100), "existing");
  assert.equal(rowStatus(o, { value: "55", absent: false }, 100), "modified");
  assert.equal(rowStatus(null, { value: "5", absent: false }, 100), "new");
});

test("bulk save: tracks, preservation, security, atomicity", { skip: !isLocal && "needs a local DATABASE_URL" }, async (t) => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, and, inArray } = await import("drizzle-orm");
  const { applyBulkMarks, loadBulkSheet, loadBulkOptions } = await import("./bulk-marks");
  const { buildProgressCardData } = await import("./progress-card");

  type Track = "school" | "madrasa" | "hifz";
  const tag = `B${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const mkUser = async (n: string, role: string) => (await db.insert(S.users).values({ username: `${tag}-${n}`, passwordHash: "x", role } as never).returning())[0];
  const admin = await mkUser("admin", "admin");
  const tutor = await mkUser("tutor", "tutor");
  const otherTutor = await mkUser("tutor2", "tutor");
  const parentUser = await mkUser("parent", "parent");

  const cls = {} as Record<Track, typeof S.classes.$inferSelect>;
  for (const k of ["school", "madrasa", "hifz"] as Track[])
    cls[k] = (await db.insert(S.classes).values({ name: `${tag}${k}`, track: k, academicYearId: year.id, tutorId: tutor.id }).returning())[0];

  const mkStudent = async (n: number, classes: Track[]) => {
    const [st] = await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: `s${n}`, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning();
    for (const k of classes) await db.insert(S.enrollments).values({ studentId: st.id, classId: cls[k].id, academicYearId: year.id });
    return st;
  };
  const s1 = await mkStudent(1, ["school", "madrasa", "hifz"]);
  const s2 = await mkStudent(2, ["school", "madrasa", "hifz"]);
  const s3 = await mkStudent(3, ["school", "madrasa", "hifz"]);
  const outsider = await mkStudent(4, []); // enrolled nowhere

  const [exam] = await db.insert(S.examinations).values({ name: `${tag}-E`, academicYearId: year.id, startDate: "2050-09-01", endDate: "2050-09-10" }).returning();
  const sess = {} as Record<Track, typeof S.examSessions.$inferSelect>;
  const subj = {} as Record<Track, typeof S.examSubjects.$inferSelect>;
  for (const k of ["school", "madrasa", "hifz"] as Track[]) {
    sess[k] = (await db.insert(S.examSessions).values({ examinationId: exam.id, name: `${tag}-${k}`, track: k, academicYearId: year.id }).returning())[0];
    subj[k] = (await db.insert(S.examSubjects).values({ examSessionId: sess[k].id, classId: cls[k].id, name: `${k}-SUBJ`, totalMarks: 100, passMarks: 35 }).returning())[0];
  }
  const A = { id: admin.id, role: "admin" };
  const T = { id: tutor.id, role: "tutor" };
  const marksOf = async (k: Track) =>
    new Map((await db.select().from(S.examMarks).where(eq(S.examMarks.examSubjectId, subj[k].id))).map((m) => [m.studentId, m]));

  try {
    // Pre-existing marks: s1 = explicit zero (with a remark), s2 = 50
    await db.insert(S.examMarks).values([
      { examSubjectId: subj.school.id, studentId: s1.id, marksObtained: "0", remarks: "keep me" },
      { examSubjectId: subj.school.id, studentId: s2.id, marksObtained: "50" },
    ]);

    await t.test("sheet loads eligible students only, with explicit zero preserved", async () => {
      const r = await loadBulkSheet(A, sess.school.id, subj.school.id);
      assert.ok(r.ok);
      assert.deepEqual(r.sheet.students.map((s) => s.id).sort(), [s1.id, s2.id, s3.id].sort());
      assert.ok(!r.sheet.students.some((s) => s.id === outsider.id));
      const z = r.sheet.students.find((s) => s.id === s1.id)!;
      assert.equal(Number(z.mark?.value), 0);
      assert.notEqual(z.mark, null); // zero is a saved mark, not "empty"
      assert.equal(r.sheet.students.find((s) => s.id === s3.id)!.mark, null);
    });

    await t.test("new + updated saved; untouched row and remarks preserved; no other track touched", async () => {
      const before = (await marksOf("school")).get(s1.id)!;
      const res = await applyBulkMarks(A, sess.school.id, subj.school.id, [
        { studentId: s2.id, value: "61.5", absent: false }, // update
        { studentId: s3.id, value: "0", absent: false },    // new explicit zero
      ]);
      assert.deepEqual(res, { ok: true, created: 1, updated: 1, unchanged: 0 });
      const m = await marksOf("school");
      assert.equal(Number(m.get(s2.id)!.marksObtained), 61.5);
      assert.equal(Number(m.get(s3.id)!.marksObtained), 0);
      assert.equal(m.get(s1.id)!.remarks, "keep me");
      assert.equal(m.get(s1.id)!.updatedAt.getTime(), before.updatedAt.getTime()); // untouched row not rewritten
      assert.equal((await marksOf("madrasa")).size, 0);
      assert.equal((await marksOf("hifz")).size, 0);
    });

    await t.test("update preserves remarks; resubmitting identical values writes nothing", async () => {
      await db.update(S.examMarks).set({ remarks: "note" }).where(and(eq(S.examMarks.examSubjectId, subj.school.id), eq(S.examMarks.studentId, s2.id)));
      const r1 = await applyBulkMarks(A, sess.school.id, subj.school.id, [{ studentId: s2.id, value: "70", absent: false }]);
      assert.deepEqual(r1, { ok: true, created: 0, updated: 1, unchanged: 0 });
      assert.equal((await marksOf("school")).get(s2.id)!.remarks, "note");
      const r2 = await applyBulkMarks(A, sess.school.id, subj.school.id, [{ studentId: s2.id, value: "70.00", absent: false }]);
      assert.deepEqual(r2, { ok: true, created: 0, updated: 0, unchanged: 1 });
    });

    await t.test("double submit / concurrent saves never duplicate a mark", async () => {
      const call = () => applyBulkMarks(A, sess.madrasa.id, subj.madrasa.id, [{ studentId: s1.id, value: "42", absent: false }]);
      const rs = await Promise.all([call(), call(), call()]);
      assert.ok(rs.every((r) => r.ok));
      const rows = await db.select().from(S.examMarks).where(and(eq(S.examMarks.examSubjectId, subj.madrasa.id), eq(S.examMarks.studentId, s1.id)));
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].marksObtained), 42);
    });

    await t.test("madrasa and hifz tracks save independently", async () => {
      for (const k of ["madrasa", "hifz"] as Track[]) {
        const r = await applyBulkMarks(A, sess[k].id, subj[k].id, [{ studentId: s2.id, value: "33", absent: false }]);
        assert.ok(r.ok, k);
        assert.equal(Number((await marksOf(k)).get(s2.id)!.marksObtained), 33);
      }
      assert.equal(Number((await marksOf("school")).get(s2.id)!.marksObtained), 70);
    });

    await t.test("absent saves absent with null marks", async () => {
      const r = await applyBulkMarks(A, sess.hifz.id, subj.hifz.id, [{ studentId: s3.id, value: "", absent: true }]);
      assert.ok(r.ok);
      const m = (await marksOf("hifz")).get(s3.id)!;
      assert.equal(m.isAbsent, true);
      assert.equal(m.marksObtained, null);
    });

    await t.test("invalid input rejected and the whole batch is atomic", async () => {
      const before = await marksOf("school");
      for (const bad of ["101", "-5", "1.234", "abc", ""]) {
        const r = await applyBulkMarks(A, sess.school.id, subj.school.id, [
          { studentId: s3.id, value: "10", absent: false },
          { studentId: s2.id, value: bad, absent: false },
        ]);
        assert.equal(r.ok, false, `value "${bad}"`);
      }
      const after = await marksOf("school");
      assert.equal(Number(after.get(s3.id)!.marksObtained), Number(before.get(s3.id)!.marksObtained)); // good row not saved either
    });

    await t.test("relationships are verified server-side", async () => {
      // subject from another session
      assert.equal((await applyBulkMarks(A, sess.madrasa.id, subj.school.id, [{ studentId: s1.id, value: "1", absent: false }])).ok, false);
      // student not enrolled in the subject's class
      assert.equal((await applyBulkMarks(A, sess.school.id, subj.school.id, [{ studentId: outsider.id, value: "1", absent: false }])).ok, false);
      // duplicate student in one submission
      assert.equal((await applyBulkMarks(A, sess.school.id, subj.school.id, [
        { studentId: s1.id, value: "1", absent: false }, { studentId: s1.id, value: "2", absent: false },
      ])).ok, false);
      assert.equal((await applyBulkMarks(A, sess.school.id, subj.school.id, [])).ok, false);
    });

    await t.test("roles and ownership", async () => {
      const c = [{ studentId: s1.id, value: "5", absent: false }];
      assert.equal((await applyBulkMarks({ id: parentUser.id, role: "parent" }, sess.school.id, subj.school.id, c)).ok, false);
      assert.equal((await loadBulkSheet({ id: parentUser.id, role: "parent" }, sess.school.id, subj.school.id)).ok, false);
      assert.equal((await applyBulkMarks({ id: otherTutor.id, role: "tutor" }, sess.school.id, subj.school.id, c)).ok, false); // not their class
      assert.equal((await applyBulkMarks(T, sess.school.id, subj.school.id, c)).ok, true); // their class
      assert.equal((await applyBulkMarks(T, sess.hifz.id, subj.hifz.id, c)).ok, false); // existing rule: unpublished Hifz hidden from tutors
      const opts = await loadBulkOptions({ id: otherTutor.id, role: "tutor" });
      assert.ok(!opts.examinations.some((e) => e.id === exam.id)); // sees nothing of other classes
      const adminOpts = await loadBulkOptions(A);
      const ex = adminOpts.examinations.find((e) => e.id === exam.id)!;
      assert.deepEqual(ex.sessions.map((s) => s.track).sort(), ["hifz", "madrasa", "school"]);
      assert.ok(ex.sessions.every((s) => s.subjects.every((x) => x.name.startsWith(s.track)))); // no cross-track subjects
    });

    await t.test("tutor-only exams block admins", async () => {
      await db.update(S.examSessions).set({ tutorMarkEntryOnly: true }).where(eq(S.examSessions.id, sess.school.id));
      assert.equal((await applyBulkMarks(A, sess.school.id, subj.school.id, [{ studentId: s1.id, value: "9", absent: false }])).ok, false);
      await db.update(S.examSessions).set({ tutorMarkEntryOnly: false }).where(eq(S.examSessions.id, sess.school.id));
    });

    await t.test("published sessions are locked; publication status never changed by saving", async () => {
      await db.update(S.examSessions).set({ resultStatus: "published", publishedAt: new Date() }).where(eq(S.examSessions.id, sess.school.id));
      const before = (await marksOf("school")).get(s2.id)!.marksObtained;
      const r = await applyBulkMarks(A, sess.school.id, subj.school.id, [{ studentId: s2.id, value: "99", absent: false }]);
      assert.equal(r.ok, false);
      assert.equal((await marksOf("school")).get(s2.id)!.marksObtained, before);
      assert.equal((await loadBulkSheet(A, sess.school.id, subj.school.id)).ok && true, true); // still viewable
      // saving on an unpublished track leaves publication flags alone
      await applyBulkMarks(A, sess.madrasa.id, subj.madrasa.id, [{ studentId: s3.id, value: "20", absent: false }]);
      const rows = await db.select().from(S.examSessions).where(inArray(S.examSessions.id, [sess.school.id, sess.madrasa.id, sess.hifz.id]));
      const st = Object.fromEntries(rows.map((x) => [x.track, x.resultStatus]));
      assert.deepEqual(st, { school: "published", madrasa: "draft", hifz: "draft" });
    });

    await t.test("progress card reads the bulk-saved marks", async () => {
      const r = await buildProgressCardData(exam.id, s2.id);
      assert.ok(r.success);
      const school = r.data.tracks.find((x) => x.track === "school")!;
      assert.equal(school.subjects[0].scored, 70);
      assert.equal(r.data.tracks.find((x) => x.track === "madrasa")!.subjects[0].scored, 33);
    });
  } finally {
    await db.delete(S.examinations).where(eq(S.examinations.id, exam.id));
    const sids = [s1.id, s2.id, s3.id, outsider.id];
    await db.delete(S.enrollments).where(inArray(S.enrollments.studentId, sids));
    await db.delete(S.students).where(inArray(S.students.id, sids));
    for (const c of Object.values(cls)) await db.delete(S.classes).where(eq(S.classes.id, c.id));
    await db.delete(S.users).where(inArray(S.users.id, [admin.id, tutor.id, otherTutor.id, parentUser.id]));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
