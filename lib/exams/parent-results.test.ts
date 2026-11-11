// Local scratch database only:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/exams/parent-results.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("parent portal never references the progress card", () => {
  const files = [...walk("app/(dashboard)/parent"), ...walk("components/parent")].filter((f) => /\.tsx?$/.test(f));
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /progress-card|ProgressReportCard|buildProgressCardData|progress-cards/, f);
  }
  const sidebar = readFileSync("components/layout/sidebar.tsx", "utf8");
  assert.doesNotMatch(sidebar, /progress-cards?/i);
});

test("admin progress card pages stay admin-only", () => {
  const src = readFileSync("app/(dashboard)/admin/exams/[id]/progress-cards/page.tsx", "utf8");
  assert.match(src, /requireAdmin\(\)/);
  assert.match(readFileSync("lib/actions/progress-cards.ts", "utf8"), /requireAdmin\(\)/);
});

test("parent results: published-only, per track, own child", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { getPublishedResultsForStudent, listPublishedExamsForStudent } = await import("./parent-results");

  type Track = "school" | "madrasa" | "hifz";
  const tag = `P${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const cls = {} as Record<Track, typeof S.classes.$inferSelect>;
  for (const t of ["school", "madrasa", "hifz"] as Track[])
    cls[t] = (await db.insert(S.classes).values({ name: `${tag}${t}`, track: t, academicYearId: year.id }).returning())[0];
  const mkStudent = async (n: number) => {
    const [st] = await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: `s${n}`, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning();
    for (const c of Object.values(cls)) await db.insert(S.enrollments).values({ studentId: st.id, classId: c.id, academicYearId: year.id });
    return st;
  };
  const a = await mkStudent(1);
  const b = await mkStudent(2);

  // School published, Madrasa draft, Hifz published
  const [exam] = await db.insert(S.examinations).values({ name: `${tag}-E`, academicYearId: year.id, startDate: "2050-09-01", endDate: "2050-09-10" }).returning();
  const status: Record<Track, "published" | "draft"> = { school: "published", madrasa: "draft", hifz: "published" };
  for (const t of ["school", "madrasa", "hifz"] as Track[]) {
    const [s] = await db.insert(S.examSessions).values({ examinationId: exam.id, name: `${tag}-${t}`, track: t, academicYearId: year.id, resultStatus: status[t] }).returning();
    const [sub] = await db.insert(S.examSubjects).values({ examSessionId: s.id, classId: cls[t].id, name: `${t}-SUBJ`, totalMarks: 100, passMarks: 35, displayOrder: 0 }).returning();
    await db.insert(S.examMarks).values({ examSubjectId: sub.id, studentId: a.id, marksObtained: "77" });
    await db.insert(S.examMarks).values({ examSubjectId: sub.id, studentId: b.id, marksObtained: "55" });
  }

  try {
    const r = await getPublishedResultsForStudent(exam.id, a.id);
    assert.ok(r);
    assert.deepEqual(r.tracks.map((t) => t.track).sort(), ["hifz", "school"]);
    assert.ok(!JSON.stringify(r).includes("madrasa-SUBJ"));
    for (const t of r.tracks) assert.equal(t.subjects[0].scored, 77); // own marks only, not student b's

    assert.ok((await listPublishedExamsForStudent(a.id)).some((e) => e.id === exam.id));

    // Publishing nothing → nothing visible
    await db.update(S.examSessions).set({ resultStatus: "draft" }).where((await import("drizzle-orm")).eq(S.examSessions.examinationId, exam.id));
    const none = await getPublishedResultsForStudent(exam.id, a.id);
    assert.equal(none?.tracks.length, 0);
  } finally {
    const { eq } = await import("drizzle-orm");
    await db.delete(S.examinations).where(eq(S.examinations.id, exam.id));
    for (const st of [a, b]) {
      await db.delete(S.enrollments).where(eq(S.enrollments.studentId, st.id));
      await db.delete(S.students).where(eq(S.students.id, st.id));
    }
    for (const c of Object.values(cls)) await db.delete(S.classes).where(eq(S.classes.id, c.id));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
