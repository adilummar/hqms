// npx tsx --test lib/validators/juz.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { juzNumberSchema, isValidJuz, findInvalidJuz, JUZ_RANGE_MESSAGE } from "./juz";
import { dailyEntrySchema, updateJuzEntrySchema } from "./hifz.schema";

test("Juz 1–30 inclusive is valid (29 and 30 work)", () => {
  for (const n of [1, 2, 15, 29, 30]) {
    assert.equal(juzNumberSchema.safeParse(n).success, true, String(n));
    assert.equal(isValidJuz(n), true);
  }
});

test("values outside 1–30 or non-integers are rejected with a clear message", () => {
  for (const n of [0, -1, 31, 100, 30.5, 1.2, NaN]) {
    const r = juzNumberSchema.safeParse(n);
    assert.equal(r.success, false, String(n));
    if (!r.success) assert.equal(r.error.issues[0].message, JUZ_RANGE_MESSAGE);
  }
  assert.equal(juzNumberSchema.safeParse("5").success, false); // numbers only on the server
  assert.equal(findInvalidJuz([1, 30]), null);
  assert.equal(findInvalidJuz([1, 31]), JUZ_RANGE_MESSAGE);
  assert.equal(findInvalidJuz([null, undefined]), null);
});

test("shared validators: daily entry and juz entry", () => {
  const base = { studentId: "11111111-1111-4111-8111-111111111111", date: "2026-11-11", sabaqJuzGiven: true, sabaqFromPage: 1, sabaqToPage: 2 };
  assert.equal(dailyEntrySchema.safeParse({ ...base, dauraJuzNumbers: [29, 30] }).success, true);
  assert.equal(dailyEntrySchema.safeParse({ ...base, dauraJuzNumbers: [31] }).success, false);
  assert.equal(dailyEntrySchema.safeParse({ ...base, dauraJuzNumbers: [0] }).success, false);
  const j = { studentId: base.studentId };
  assert.equal(updateJuzEntrySchema.safeParse({ ...j, juzNumber: 30 }).success, true);
  assert.equal(updateJuzEntrySchema.safeParse({ ...j, juzNumber: 29 }).success, true);
  assert.equal(updateJuzEntrySchema.safeParse({ ...j, juzNumber: 31 }).success, false);
});

test("every Juz field in the server actions uses the shared 1–30 schema", () => {
  const src = readFileSync("lib/actions/hifz.ts", "utf8");
  for (const field of ["sabaqJuzNumber", "dauraJuzNumbers", "daura2JuzNumbers", "startJuzNumber", "juzNumber"]) {
    const lines = src.split("\n").filter((l) => new RegExp(`^\\s*${field}:`).test(l) && /z\./.test(l) || new RegExp(`^\\s*${field}:\\s*juzNumberSchema`).test(l));
    assert.ok(lines.length > 0, field);
    for (const l of lines) assert.match(l, /juzNumberSchema/, `${field}: ${l.trim()}`);
  }
});
