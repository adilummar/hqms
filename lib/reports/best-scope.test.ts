// Local scratch DB only:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/reports/best-scope.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

test("best-report scope = active Hifz classes named HA/HB/HC only", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { getBestReportClasses } = await import("./best-scope");

  const [year] = await db.insert(S.academicYears).values({ label: `BS${Date.now() % 1e9}`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const mk = async (name: string, track: "hifz" | "school" | "madrasa", isActive = true) =>
    (await db.insert(S.classes).values({ name, track, academicYearId: year.id, isActive }).returning())[0];

  const ha = await mk("HA", "hifz");
  const hb = await mk("HB", "hifz");
  const hc = await mk("HC", "hifz");
  const others = [
    await mk("HA", "school"),       // same name, wrong track
    await mk("M1", "madrasa"),
    await mk("Class 5", "school"),
    await mk("HD", "hifz"),         // another Hifz class
    await mk("HB", "hifz", false),  // inactive duplicate
  ];
  try {
    const got = await getBestReportClasses();
    const mine = got.filter((c) => c.academicYearId === year.id).map((c) => c.id).sort();
    assert.deepEqual(mine, [ha.id, hb.id, hc.id].sort());
    assert.ok(got.every((c) => c.track === "hifz" && ["HA", "HB", "HC"].includes(c.name)));
    for (const o of others) assert.ok(!got.some((c) => c.id === o.id));
  } finally {
    await db.delete(S.classes).where(inArray(S.classes.id, [ha.id, hb.id, hc.id, ...others.map((o) => o.id)]));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
