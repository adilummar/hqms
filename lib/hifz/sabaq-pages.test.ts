// Pure tests run anywhere; the DB test needs a local scratch DB:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/hifz/sabaq-pages.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcSabaqPages, validateSabaqRange, resolveSabaqPages, continuationFromPage } from "./sabaq-pages";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

test("inclusive page range: To − From + 1", () => {
  const table: [string, string, string][] = [
    ["5", "10", "6"], ["1", "1", "1"], ["10", "15", "6"], ["19", "20", "2"], ["1", "20", "20"], ["5", "5", "1"],
    ["14.5", "15", "1.5"],
  ];
  for (const [f, t, want] of table) {
    assert.equal(calcSabaqPages(f, t), want, `${f}→${t}`);
    // Individual and Bulk both store the same value for the same input
    assert.equal(resolveSabaqPages(f, t, null, true), want); // bulk (authoritative)
    assert.equal(resolveSabaqPages(f, t, undefined, false), want); // individual, total not typed
    assert.equal(resolveSabaqPages(f, t, want, false), want); // individual, UI-computed total
  }
  assert.equal(calcSabaqPages("", "10"), "");
  assert.equal(calcSabaqPages("10", "5"), "");
  assert.equal(resolveSabaqPages("5", "10", "999", true), "6"); // bulk ignores any client-sent total
});

test("range validation: reversed, negative, over page limit", () => {
  assert.equal(validateSabaqRange("5", "10"), null);
  assert.equal(validateSabaqRange("5", "5"), null);
  assert.equal(validateSabaqRange("", ""), null);
  assert.equal(validateSabaqRange("5", ""), null); // half-entered is not an error
  assert.match(validateSabaqRange("10", "5")!, /before/);
  assert.match(validateSabaqRange("-1", "5")!, /negative/);
  assert.match(validateSabaqRange("1", "605")!, /604/);
  assert.equal(validateSabaqRange(1, 604), null);
});

test("continuation: whole end → next page, half end → same page, none → nothing", () => {
  assert.equal(continuationFromPage("4.0"), "5");
  assert.equal(continuationFromPage("4"), "5");
  assert.equal(continuationFromPage("14.5"), "14.5");
  assert.equal(continuationFromPage(null), undefined);
  assert.equal(continuationFromPage(""), undefined);
  // together with the inclusive rule: previous ended 4 → next 5..10 = 6 pages
  assert.equal(calcSabaqPages(continuationFromPage("4.0")!, "10"), "6");
});

test("no exclusive (to − from) formula remains in any save/UI path", () => {
  for (const f of ["components/hifz/hifz-bulk-entry.tsx", "components/hifz/hifz-entry-form.tsx", "lib/actions/students.ts", "lib/actions/hifz.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /sabaqToPage\s*-\s*d\.sabaqFromPage|\(t - f\)/, f);
  }
  assert.match(readFileSync("components/hifz/hifz-bulk-entry.tsx", "utf8"), /calcSabaqPages/);
  assert.match(readFileSync("components/hifz/hifz-entry-form.tsx", "utf8"), /calcSabaqPages/);
});

test("continuation per student + monthly progress from saved pages (DB)", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { getPreviousSabaqEnds } = await import("@/lib/services/hifz-continuation");
  const { getMonthlySabaqPages } = await import("@/lib/services/hifz-monthly-rank");

  const tag = `C${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const [user] = await db.insert(S.users).values({ username: `${tag}-u`, passwordHash: "x", role: "tutor" } as never).returning();
  const mk = async (n: number) =>
    (await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: `s${n}`, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning())[0];
  const [a, b, c, d] = [await mk(1), await mk(2), await mk(3), await mk(4)];
  const e = (studentId: string, date: string, extra: object) => ({ studentId, date, recordedBy: user.id, ...extra });

  await db.insert(S.hifzDailyEntries).values([
    // a: multiple historical entries → latest before the date wins (ended 4.0)
    e(a.id, "2050-09-01", { sabaqFromPage: "1", sabaqToPage: "2", sabaqPages: "2" }),
    e(a.id, "2050-09-03", { sabaqFromPage: "3", sabaqToPage: "4.0", sabaqPages: "2" }),
    e(a.id, "2050-09-10", { sabaqFromPage: "5", sabaqToPage: "10", sabaqPages: "6" }), // on/after the date: ignored
    // b: different ending page, and a cross-Juz style continuation value
    e(b.id, "2050-09-02", { sabaqFromPage: "10", sabaqToPage: "18.5", sabaqPages: "9.5", sabaqJuzNumber: 28 }),
    // c: latest entry is reason-only → no end page (same as Individual always behaved)
    e(c.id, "2050-09-02", { sabaqFromPage: "1", sabaqToPage: "5", sabaqPages: "5" }),
    e(c.id, "2050-09-04", {}),
    // d: no history at all
  ]);
  try {
    const ends = await getPreviousSabaqEnds([a.id, b.id, c.id, d.id], "2050-09-10");
    assert.equal(Number(ends.get(a.id)), 4);
    assert.equal(Number(ends.get(b.id)), 18.5);
    assert.equal(ends.get(c.id), null);
    assert.equal(ends.has(d.id), false);

    // Individual (one id) and Bulk (whole class) give identical answers
    for (const s of [a, b, c, d]) {
      const one = await getPreviousSabaqEnds([s.id], "2050-09-10");
      assert.equal(one.get(s.id) ?? null, ends.get(s.id) ?? null);
    }

    // Entry date changes → the correct historical record
    assert.equal(Number((await getPreviousSabaqEnds([a.id], "2050-09-03")).get(a.id)), 2);
    assert.equal(Number((await getPreviousSabaqEnds([a.id], "2050-09-11")).get(a.id)), 10);
    assert.equal((await getPreviousSabaqEnds([a.id], "2050-09-01")).has(a.id), false);

    // Monthly progress sums the saved (inclusive) page counts: 2 + 2 + 6
    const totals = await getMonthlySabaqPages([a.id], new Date("2050-09-20T06:00:00Z"));
    assert.equal(totals.get(a.id), 10);
    // previous ended 4 → next 5..10 saved as 6 pages
    assert.equal(calcSabaqPages(continuationFromPage(String(Number(ends.get(a.id))))!, "10"), "6");
  } finally {
    const ids = [a.id, b.id, c.id, d.id];
    await db.delete(S.hifzDailyEntries).where(inArray(S.hifzDailyEntries.studentId, ids));
    await db.delete(S.students).where(inArray(S.students.id, ids));
    await db.delete(S.users).where(eq(S.users.id, user.id));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
