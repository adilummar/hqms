// Pure tests run anywhere. The DB test needs a local scratch DB:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/services/hifz-monthly-rank.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

test("IST month boundaries and rollover", async () => {
  const { currentMonthRange, istDateString } = await import("./hifz-monthly-rank");
  // 2026-11-30 20:00 UTC is already Dec 1, 01:30 IST → new month starts in IST, not UTC
  assert.deepEqual(currentMonthRange(new Date("2026-11-30T20:00:00Z")), { start: "2026-12-01", end: "2026-12-01" });
  // 2026-11-01 00:10 IST == 2026-10-31 18:40 UTC → still November in IST
  assert.deepEqual(currentMonthRange(new Date("2026-10-31T18:40:00Z")), { start: "2026-11-01", end: "2026-11-01" });
  assert.deepEqual(currentMonthRange(new Date("2026-11-11T05:00:00Z")), { start: "2026-11-01", end: "2026-11-11" });
  assert.equal(istDateString(new Date("2027-01-01T00:00:00Z")), "2027-01-01");
});

test("ranking order: pages desc, zero last, ties alphabetical", async () => {
  const { rankByMonthlyPages } = await import("./hifz-monthly-rank");
  const mk = (id: string, firstName: string) => ({ id, firstName, lastName: null });
  const list = [mk("f", "Fahad"), mk("b", "Bilal"), mk("a", "Adil"), mk("c", "Cader"), mk("z", "Zayd"), mk("e", "Ebrahim")];
  const totals = new Map([["a", 85], ["b", 50], ["c", 10], ["e", 50], ["z", 0]]); // f has no entry
  const r = rankByMonthlyPages(list, totals);
  assert.deepEqual(r.map((x) => x.firstName), ["Adil", "Bilal", "Ebrahim", "Cader", "Fahad", "Zayd"]);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3, 4, 5, 6]);
  assert.equal(r.length, list.length); // nobody dropped
});

test("monthly Sabaq totals from DB", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { getMonthlySabaqPages } = await import("./hifz-monthly-rank");

  const tag = `M${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const [user] = await db.insert(S.users).values({ username: `${tag}-u`, passwordHash: "x", role: "tutor" }).returning();
  const mk = async (n: number) =>
    (await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: `s${n}`, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning())[0];
  const [a, b] = [await mk(1), await mk(2)];

  const now = new Date("2050-09-15T06:00:00Z");
  const row = (studentId: string, date: string, extra: object) => ({ studentId, date, recordedBy: user.id, ...extra });
  await db.insert(S.hifzDailyEntries).values([
    row(a.id, "2050-09-01", { sabaqPages: "10.0" }),                 // first day counts
    row(a.id, "2050-09-15", { sabaqPages: "2.5" }),                  // today counts
    row(a.id, "2050-09-10", { dauraJuzNumbers: [1, 2], sabaqJuzGiven: true }), // revision: no pages
    row(a.id, "2050-09-12", { sabaqRemarksId: null }),               // reason / no pages
    row(a.id, "2050-08-31", { sabaqPages: "99.0" }),                 // previous month
    row(a.id, "2050-09-16", { sabaqPages: "99.0" }),                 // future
    row(b.id, "2050-09-05", { sabaqPages: "3.0" }),
  ]);
  try {
    const t = await getMonthlySabaqPages([a.id, b.id], now);
    assert.equal(t.get(a.id), 12.5);
    assert.equal(t.get(b.id), 3);
  } finally {
    await db.delete(S.hifzDailyEntries).where(inArray(S.hifzDailyEntries.studentId, [a.id, b.id]));
    for (const s of [a, b]) await db.delete(S.students).where(eq(S.students.id, s.id));
    await db.delete(S.users).where(eq(S.users.id, user.id));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
