// Pure tests (no database): track-scoped authorisation, progress aggregation, overview
// derivations and filter parsing. DB-backed overview/publication isolation is covered at the
// bottom and only runs against a LOCAL scratch database (see track-isolation.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMarkWriteAccess } from "./mark-guard";
import { summarizeProgress } from "./session-progress";
import { deriveOverallStatus, summarize, parseFilters, type OverviewRow } from "./overview";

type T = "school" | "madrasa" | "hifz";
const target = (track: T, over: Partial<{ resultStatus: string; tutorMarkEntryOnly: boolean; clsTrack: T; tutorId: string | null }> = {}) => ({
  session: { track, resultStatus: over.resultStatus ?? "draft", tutorMarkEntryOnly: over.tutorMarkEntryOnly ?? false },
  cls: { track: over.clsTrack ?? track, tutorId: over.tutorId ?? null },
});

test("mark write access: published sessions are locked for every role", () => {
  for (const role of ["super_admin", "admin", "tutor", "school_admin"]) {
    assert.match(checkMarkWriteAccess({ id: "u", role }, target("school", { resultStatus: "published", tutorId: "u" }))!, /locked|published|Hifz/i);
  }
});

test("mark write access: class track must equal session track (no school/madrasa mixing)", () => {
  assert.match(checkMarkWriteAccess({ id: "u", role: "admin" }, target("school", { clsTrack: "madrasa" }))!, /track/);
});

test("mark write access: parents/students/madrasa_admin are refused", () => {
  for (const role of ["parent", "student", "madrasa_admin"]) {
    assert.ok(checkMarkWriteAccess({ id: "u", role }, target("school")));
  }
});

test("mark write access: school_admin is limited to the school track", () => {
  assert.equal(checkMarkWriteAccess({ id: "u", role: "school_admin" }, target("school")), null);
  assert.ok(checkMarkWriteAccess({ id: "u", role: "school_admin" }, target("madrasa")));
  assert.ok(checkMarkWriteAccess({ id: "u", role: "school_admin" }, target("hifz")));
});

test("mark write access: tutors only enter marks for their own class; Hifz stays gated", () => {
  assert.equal(checkMarkWriteAccess({ id: "t1", role: "tutor" }, target("madrasa", { tutorId: "t1" })), null);
  assert.ok(checkMarkWriteAccess({ id: "t1", role: "tutor" }, target("madrasa", { tutorId: "t2" })));
  assert.ok(checkMarkWriteAccess({ id: "t1", role: "tutor" }, target("hifz", { tutorId: "t1" })));
});

test("mark write access: tutorMarkEntryOnly excludes admins, not tutors", () => {
  assert.ok(checkMarkWriteAccess({ id: "a", role: "admin" }, target("school", { tutorMarkEntryOnly: true })));
  assert.equal(checkMarkWriteAccess({ id: "t", role: "tutor" }, target("school", { tutorMarkEntryOnly: true, tutorId: "t" })), null);
});

test("session progress is aggregated per session, never across tracks", () => {
  const subjects = [
    { id: "s1", sessionId: "school", classId: "c1" },
    { id: "s2", sessionId: "school", classId: "c1" },
    { id: "m1", sessionId: "madrasa", classId: "c2" },
  ];
  const p = summarizeProgress(subjects, new Map([["c1", 10], ["c2", 4]]), new Map([["s1", 10], ["s2", 3], ["m1", 0]]));
  assert.deepEqual(p.get("school"), { subjects: 2, expected: 20, entered: 13, missing: 7 });
  assert.deepEqual(p.get("madrasa"), { subjects: 1, expected: 4, entered: 0, missing: 4 });
  assert.equal(p.get("hifz"), undefined);
});

test("overall status derives only from configured tracks", () => {
  assert.equal(deriveOverallStatus([]), "not_configured");
  assert.equal(deriveOverallStatus(["scheduled", "scheduled"]), "scheduled");
  assert.equal(deriveOverallStatus(["completed", "scheduled"]), "ongoing");
  assert.equal(deriveOverallStatus(["completed", "completed"]), "completed");
  assert.equal(deriveOverallStatus(["completed", "cancelled"]), "completed");
  assert.equal(deriveOverallStatus(["scheduled", "ongoing"]), "ongoing");
});

test("overview summary counts track exams and publication independently", () => {
  const cell = (track: T, status: "scheduled" | "completed", published: boolean, missing: number) => ({
    sessionId: track, track, status, published, publishedAt: null, startDate: null, endDate: null,
    progress: { subjects: 1, expected: 5, entered: 5 - missing, missing },
  });
  const rows: OverviewRow[] = [
    { id: "e1", name: "E1", yearLabel: "Y", academicYearId: "y", overallStatus: "ongoing",
      tracks: { school: cell("school", "completed", true, 0), madrasa: cell("madrasa", "scheduled", false, 2) } },
    { id: "e2", name: "E2", yearLabel: "Y", academicYearId: "y", overallStatus: "not_configured", tracks: {} },
  ];
  assert.deepEqual(summarize(rows), {
    commonExams: 2, configuredTrackExams: 2, scheduled: 1, ongoing: 0, completed: 1,
    pendingMarkEntry: 1, published: 1, unpublished: 1,
  });
});

test("filter parsing rejects junk and keeps valid values", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(parseFilters({ year: id, exam: "nope", track: "madrasa", status: "ongoing", publication: "published" }), {
    academicYearId: id, track: "madrasa", status: "ongoing", publication: "published",
  });
  assert.deepEqual(parseFilters({ track: "bogus", status: "x", publication: "y" }), {});
});

// ─── DB-backed: filters run in SQL and publication is per track ───────────────
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL ?? "");

test("overview filters and per-track publication (local DB only)", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { loadOverview } = await import("./overview");

  const label = `W${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label, startDate: new Date("2031-06-01"), endDate: new Date("2032-05-31") }).returning();
  const [exam] = await db.insert(S.examinations).values({ name: `${label} First Term`, academicYearId: year.id }).returning();
  try {
    // School published, Madrasa draft, Hifz not configured at all
    await db.insert(S.examSessions).values([
      { examinationId: exam.id, name: "s", track: "school", academicYearId: year.id, resultStatus: "published", startDate: "2031-06-10", endDate: "2031-06-15" },
      { examinationId: exam.id, name: "m", track: "madrasa", academicYearId: year.id, startDate: "2031-06-18", endDate: "2031-06-22" },
    ]);
    const all = await loadOverview({ academicYearId: year.id });
    assert.equal(all.rows.length, 1);
    assert.deepEqual(Object.keys(all.rows[0].tracks).sort(), ["madrasa", "school"]);
    assert.equal(all.rows[0].tracks.school!.startDate, "2031-06-10");
    assert.equal(all.rows[0].tracks.madrasa!.startDate, "2031-06-18");
    assert.equal(all.rows[0].tracks.school!.published, true);
    assert.equal(all.rows[0].tracks.madrasa!.published, false);

    const onlyMadrasa = await loadOverview({ academicYearId: year.id, track: "madrasa" });
    assert.deepEqual(Object.keys(onlyMadrasa.rows[0].tracks), ["madrasa"]);
    assert.equal((await loadOverview({ academicYearId: year.id, track: "hifz" })).rows.length, 0);
    assert.equal((await loadOverview({ academicYearId: year.id, publication: "published" })).rows[0].tracks.madrasa, undefined);
    assert.equal((await loadOverview({ academicYearId: year.id, track: "school", publication: "unpublished" })).rows.length, 0);
    assert.equal((await loadOverview({ examinationId: exam.id })).summary.published, 1);
  } finally {
    await db.delete(S.examinations).where(eq(S.examinations.id, exam.id));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});

