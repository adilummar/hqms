// Pure tests run anywhere. DB test needs a local scratch DB:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:54329/hqms_test npx tsx --test lib/attendance/status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyToAll, collapseOffSessions, isOffStatus, type RosterStatus } from "./status";
import { calculateAttendanceMetrics, getDailyAttendanceOutcome } from "@/lib/utils/attendance-calculator";
import { bulkMarkAttendanceSchema } from "@/lib/validators/attendance.schema";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);

test("bulk action on one session never touches the other (FN/AN independence)", () => {
  const fn: Record<string, RosterStatus> = { a: "present", b: "absent", c: "unmarked" };
  const an: Record<string, RosterStatus> = { a: "absent", b: "holiday", c: "present" };
  const fnBefore = { ...fn };
  const anBefore = { ...an };

  const fnFriday = applyToAll(fn, "friday"); // FN → All Friday
  assert.deepEqual(fnFriday, { a: "friday", b: "friday", c: "friday" });
  assert.deepEqual(an, anBefore); // AN state untouched

  const anHoliday = applyToAll(an, "holiday"); // AN → All Holiday
  assert.deepEqual(anHoliday, { a: "holiday", b: "holiday", c: "holiday" });
  assert.deepEqual(fn, fnBefore); // FN state untouched

  // Existing actions still behave the same
  assert.deepEqual(applyToAll(fn, "present"), { a: "present", b: "present", c: "present" });
  assert.deepEqual(applyToAll(fn, "absent"), { a: "absent", b: "absent", c: "absent" });
  assert.deepEqual(applyToAll(fn, "unmarked"), { a: "unmarked", b: "unmarked", c: "unmarked" });
  // Eligible students only: exactly the keys given
  assert.deepEqual(Object.keys(applyToAll({ x: "present" }, "friday")), ["x"]);
});

test("off-day sessions are excluded from outcome and percentage", () => {
  assert.equal(isOffStatus("friday"), true);
  assert.equal(isOffStatus("leave"), false);
  assert.deepEqual(collapseOffSessions("friday", "friday"), { fn: "friday", an: "friday", offDay: "friday" });
  assert.equal(collapseOffSessions("friday", "holiday").offDay, "holiday");
  assert.deepEqual(collapseOffSessions("friday", "present"), { fn: "present", an: "present", offDay: null });

  assert.equal(getDailyAttendanceOutcome("friday", "friday"), "OFF_DAY");
  assert.equal(getDailyAttendanceOutcome("holiday", "holiday"), "OFF_DAY");
  assert.equal(getDailyAttendanceOutcome("friday", "present"), "FULL_DAY_PRESENT"); // the worked session decides
  assert.equal(getDailyAttendanceOutcome("holiday", "absent"), "FULL_DAY_ABSENT");
  assert.equal(getDailyAttendanceOutcome("friday", "unmarked"), "PENDING_PARTIAL");
  // Existing meanings unchanged
  assert.equal(getDailyAttendanceOutcome("present", "present"), "FULL_DAY_PRESENT");
  assert.equal(getDailyAttendanceOutcome("present", "absent"), "HALF_DAY_PRESENT");
  assert.equal(getDailyAttendanceOutcome("absent", "absent"), "FULL_DAY_ABSENT");
  assert.equal(getDailyAttendanceOutcome("unmarked", "unmarked"), "NO_RECORD");
  assert.equal(getDailyAttendanceOutcome("present", "unmarked"), "PENDING_PARTIAL");

  // Monthly: 2 present days + a Friday + a Holiday → 100%, off sessions not counted at all
  const m = calculateAttendanceMetrics([
    { fn: "present", an: "present" },
    { fn: "present", an: "present" },
    { fn: "friday", an: "friday" },
    { fn: "holiday", an: "holiday" },
  ]);
  assert.equal(m.presentSessions, 4);
  assert.equal(m.absentSessions, 0);
  assert.equal(m.unmarkedSessions, 0);
  assert.equal(m.attendancePercentage, 100);
  // An absent day still lowers it; off days do not
  const m2 = calculateAttendanceMetrics([{ fn: "present", an: "present" }, { fn: "absent", an: "absent" }, { fn: "friday", an: "friday" }]);
  assert.equal(m2.attendancePercentage, 50);
});

test("validator: friday/holiday need no absence reason; absent still does", () => {
  const base = { classId: "11111111-1111-4111-8111-111111111111", track: "hifz", date: "2026-11-13" };
  const e = (status: string) => ({ studentId: "22222222-2222-4222-8222-222222222222", session: "FN", status });
  assert.equal(bulkMarkAttendanceSchema.safeParse({ ...base, entries: [e("friday"), e("holiday")] }).success, true);
  assert.equal(bulkMarkAttendanceSchema.safeParse({ ...base, entries: [e("absent")] }).success, false);
  assert.equal(bulkMarkAttendanceSchema.safeParse({ ...base, entries: [e("weekend")] }).success, false);
});

test("roster exposes All Friday / All Holiday under BOTH sessions, in the existing button style", () => {
  const src = readFileSync("components/attendance/attendance-roster.tsx", "utf8");
  for (const fn of ["setAllFn", "setAllAn"]) {
    assert.match(src, new RegExp(`${fn}\\("friday"\\)`));
    assert.match(src, new RegExp(`${fn}\\("holiday"\\)`));
  }
  assert.equal((src.match(/>All Friday</g) ?? []).length, 2);
  assert.equal((src.match(/>All Holiday</g) ?? []).length, 2);
});

test("migration adds the off-day statuses; FN/AN rows stay independent in the DB", { skip: !isLocal && "needs a local DATABASE_URL" }, async () => {
  const { db } = await import("@/lib/db");
  const S = await import("@/lib/db/schema");
  const { and, eq, inArray, isNull } = await import("drizzle-orm");
  const { Pool } = await import("pg");

  // Apply the real migration file (idempotent) — twice, to prove it is re-runnable
  const pool = new Pool({ connectionString: url });
  const stmts = readFileSync("drizzle/0011_attendance_off_days.sql", "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < 2; i++) for (const s of stmts) await pool.query(s);
  await pool.end();

  const tag = `AT${Date.now() % 1e9}`;
  const [year] = await db.insert(S.academicYears).values({ label: `${tag}y`, startDate: new Date("2050-06-01"), endDate: new Date("2051-05-31") }).returning();
  const [user] = await db.insert(S.users).values({ username: `${tag}-u`, passwordHash: "x", role: "tutor" } as never).returning();
  const [cls] = await db.insert(S.classes).values({ name: `${tag}C`, track: "hifz", academicYearId: year.id }).returning();
  const mk = async (n: number) =>
    (await db.insert(S.students).values({
      studentCode: `${tag}-${n}`, admissionNumber: `${tag}${n}`, firstName: `s${n}`, dateOfBirth: "2012-01-01",
      gender: "male", admissionDate: "2024-06-01", admissionYearId: year.id,
    } as never).returning())[0];
  const [s1, s2] = [await mk(1), await mk(2)];
  const date = "2050-09-12";
  const row = (studentId: string, session: "FN" | "AN", status: "present" | "absent" | "friday" | "holiday") =>
    ({ studentId, classId: cls.id, track: "hifz" as const, date, session, status, recordedBy: user.id });
  try {
    // Existing AN data, then FN → Friday for everyone (what the FN "All Friday" save writes)
    await db.insert(S.attendanceRecords).values([row(s1.id, "AN", "present"), row(s2.id, "AN", "absent")]);
    await db.insert(S.attendanceRecords).values([row(s1.id, "FN", "friday"), row(s2.id, "FN", "friday")]);
    const rows = await db.select().from(S.attendanceRecords).where(and(inArray(S.attendanceRecords.studentId, [s1.id, s2.id]), isNull(S.attendanceRecords.deletedAt)));
    const get = (id: string, ses: string) => rows.find((r) => r.studentId === id && r.session === ses)!.status;
    assert.equal(get(s1.id, "FN"), "friday");
    assert.equal(get(s2.id, "FN"), "friday");
    assert.equal(get(s1.id, "AN"), "present"); // AN untouched
    assert.equal(get(s2.id, "AN"), "absent");

    // AN → Holiday leaves FN alone, and re-saving the same session updates in place (no duplicates)
    for (const id of [s1.id, s2.id])
      await db.insert(S.attendanceRecords).values(row(id, "AN", "holiday")).onConflictDoUpdate({
        target: [S.attendanceRecords.studentId, S.attendanceRecords.classId, S.attendanceRecords.date, S.attendanceRecords.session],
        set: { status: "holiday", updatedAt: new Date(), deletedAt: null },
      });
    const after = await db.select().from(S.attendanceRecords).where(inArray(S.attendanceRecords.studentId, [s1.id, s2.id]));
    assert.equal(after.length, 4); // still one row per student per session
    assert.deepEqual(after.filter((r) => r.session === "FN").map((r) => r.status), ["friday", "friday"]);
    assert.deepEqual(after.filter((r) => r.session === "AN").map((r) => r.status), ["holiday", "holiday"]);
  } finally {
    await db.delete(S.attendanceRecords).where(inArray(S.attendanceRecords.studentId, [s1.id, s2.id]));
    await db.delete(S.students).where(inArray(S.students.id, [s1.id, s2.id]));
    await db.delete(S.classes).where(eq(S.classes.id, cls.id));
    await db.delete(S.users).where(eq(S.users.id, user.id));
    await db.delete(S.academicYears).where(eq(S.academicYears.id, year.id));
  }
});
