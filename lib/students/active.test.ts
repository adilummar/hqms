import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isOperationalStudent, isActiveStudentStatus } from "./active";

// ── Pure eligibility rule ────────────────────────────────────────────────────
test("active student with active enrollment is operational", () => {
  assert.equal(isOperationalStudent("active", "active"), true);
});

test("discontinued / completed students are not operational even with an active enrollment", () => {
  assert.equal(isOperationalStudent("discontinued", "active"), false);
  assert.equal(isOperationalStudent("completed", "active"), false);
});

test("withdrawn / completed / missing enrollment (transferred, no current class) is not operational", () => {
  assert.equal(isOperationalStudent("active", "withdrawn"), false);
  assert.equal(isOperationalStudent("active", "completed"), false);
  assert.equal(isOperationalStudent("active", null), false);
  assert.equal(isOperationalStudent("active", undefined), false);
});

test("student with history but no active enrollment is not operational", () => {
  assert.equal(isOperationalStudent("discontinued", "completed"), false);
});

test("isActiveStudentStatus only accepts 'active'", () => {
  assert.equal(isActiveStudentStatus("active"), true);
  for (const s of ["completed", "discontinued", "", null, undefined]) assert.equal(isActiveStudentStatus(s as never), false);
});

// ── Regression guard: operational queries keep the active-student condition ──
const read = (p: string) => readFileSync(p, "utf8");

const LIST_SOURCES = [
  "app/(dashboard)/tutor/hifz/page.tsx", // Tutor Hifz Entry
  "app/(dashboard)/tutor/hifz/bulk/page.tsx", // Bulk Hifz Entry
  "app/(dashboard)/tutor/exams/[id]/marks/[classId]/page.tsx", // individual mark entry (tutor)
  "app/(dashboard)/admin/exams/[id]/marks/[classId]/page.tsx",
  "app/(dashboard)/madrasa-admin/exams/[id]/marks/[classId]/page.tsx",
  "app/(dashboard)/school-admin/exams/[id]/marks/[classId]/page.tsx",
  "app/(dashboard)/admin/exams/[id]/halltickets/[classId]/page.tsx",
  "app/(dashboard)/admin/settings/targets/page.tsx",
  "lib/exams/bulk-marks.ts", // bulk mark roster + server eligibility
  "lib/exams/mark-guard.ts", // individual mark server eligibility
  "lib/actions/stars.ts",
  "lib/actions/hifz-targets.ts",
  "lib/actions/parent-meetings.ts",
];

for (const p of LIST_SOURCES) {
  test(`${p} filters operational students to ACTIVE students`, () => {
    assert.match(read(p), /enrollmentStudentIsActive\(\)/);
  });
}

// Attendance pages already filter students.status directly
for (const p of ["app/(dashboard)/tutor/attendance/page.tsx", "app/(dashboard)/admin/attendance/page.tsx"]) {
  test(`${p} lists only active students`, () => {
    assert.match(read(p), /students\.status, "active"/);
  });
}

// ── Server actions reject NEW records for inactive students ──────────────────
const ACTIONS: [string, RegExp][] = [
  ["lib/actions/hifz.ts", /findInactiveStudentIds[\s\S]*saveBulkHifzEntries|saveDailyHifzEntry[\s\S]*findInactiveStudentIds/],
  ["lib/actions/attendance.ts", /inactiveWithoutRecord/],
  ["lib/actions/stars.ts", /findInactiveStudentIds/],
  ["lib/actions/leave-tracker.ts", /findInactiveStudentIds/],
  ["lib/actions/parent-meetings.ts", /findInactiveStudentIds/],
  ["lib/actions/academic-year.ts", /findInactiveStudentIds/],
];
for (const [p, re] of ACTIONS) {
  test(`${p} validates student is active server-side`, () => {
    assert.match(read(p), re);
  });
}

// ── History is preserved: historical sources must NOT apply the current-active filter ──
const HISTORICAL = [
  "lib/exams/progress-card.ts",
  "lib/exams/parent-results.ts",
  "lib/exams/session-progress.ts",
  "lib/actions/reports.ts",
];
for (const p of HISTORICAL) {
  test(`${p} (historical) does not use the operational active-student filter`, () => {
    assert.doesNotMatch(read(p), /enrollmentStudentIsActive|findInactiveStudentIds/);
  });
}
