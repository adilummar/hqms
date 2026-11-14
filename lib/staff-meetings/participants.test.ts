// npx tsx --test lib/staff-meetings/participants.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  MEETING_CATEGORIES,
  categoryFields,
  validateCustomCategory,
  normalizeCategory,
  categoryLabel,
  externalParticipantSchema,
  findDuplicateExternal,
  participantsSchema,
} from "./participants";

const catSchema = z.object(categoryFields).superRefine(validateCustomCategory);

test("school / madrasa / management / custom categories are accepted", () => {
  for (const c of ["school", "madrasa", "management"]) {
    assert.equal(catSchema.safeParse({ category: c }).success, true, c);
  }
  assert.equal(catSchema.safeParse({ category: "custom", customCategory: "Parent Coordination" }).success, true);
  assert.deepEqual([...MEETING_CATEGORIES], ["school", "madrasa", "management", "custom"]);
});

test("category is required and must be a known value", () => {
  assert.equal(catSchema.safeParse({}).success, false);
  assert.equal(catSchema.safeParse({ category: "other" }).success, false);
});

test("custom requires a non-empty trimmed description", () => {
  for (const bad of [undefined, null, "", "   "]) {
    const r = catSchema.safeParse({ category: "custom", customCategory: bad });
    assert.equal(r.success, false, String(bad));
  }
  const long = catSchema.safeParse({ category: "custom", customCategory: "x".repeat(101) });
  assert.equal(long.success, false);
});

test("switching away from custom drops the old custom text", () => {
  assert.deepEqual(normalizeCategory({ category: "school", customCategory: "Old text" }), {
    category: "school",
    customCategory: null,
  });
  assert.deepEqual(normalizeCategory({ category: "custom", customCategory: "  Special Committee  " }), {
    category: "custom",
    customCategory: "Special Committee",
  });
});

test("category labels: legacy meetings have none, custom shows the description", () => {
  assert.equal(categoryLabel(null), null);
  assert.equal(categoryLabel("school"), "School");
  assert.equal(categoryLabel("management"), "Management");
  assert.equal(categoryLabel("custom", "Special Committee"), "Special Committee");
});

test("external participant: name required, fields trimmed/collapsed, optional fields", () => {
  assert.equal(externalParticipantSchema.safeParse({ name: "" }).success, false);
  assert.equal(externalParticipantSchema.safeParse({ name: "   " }).success, false);
  const r = externalParticipantSchema.parse({ name: "  Abdul   Rahman ", designation: " Guest  Lecturer ", contactNumber: "" });
  assert.equal(r.name, "Abdul Rahman");
  assert.equal(r.designation, "Guest Lecturer");
  assert.equal(r.contactNumber, null);
  assert.equal(externalParticipantSchema.safeParse({ name: "Abdul", contactNumber: "abc<script>" }).success, false);
  assert.equal(externalParticipantSchema.safeParse({ name: "Abdul", contactNumber: "+91 98765 43210" }).success, true);
});

test("duplicate external participants are detected case-insensitively", () => {
  assert.equal(findDuplicateExternal([{ name: "Abdul Rahman", designation: "Guest" }, { name: "abdul  rahman", designation: "guest" }]), "abdul rahman");
  assert.equal(findDuplicateExternal([{ name: "Abdul Rahman", designation: "Guest" }, { name: "Abdul Rahman", designation: "Trustee" }]), null);
  assert.equal(findDuplicateExternal([{ name: "A B" }, { name: "C D" }]), null);
});

test("participants schema requires uuid staff ids", () => {
  assert.equal(participantsSchema.safeParse({ participantUserIds: ["not-a-uuid"], externalParticipants: [] }).success, false);
  assert.equal(
    participantsSchema.safeParse({
      participantUserIds: ["11111111-1111-4111-8111-111111111111"],
      externalParticipants: [{ name: "Guest One" }],
    }).success,
    true
  );
});

// Structural guarantees (no DB needed): external guests never touch users / user-id constraints.
test("external participants are stored in their own table, not in users or attendance", () => {
  const schema = readFileSync("lib/db/schema/attendance.ts", "utf8");
  assert.match(schema, /staff_meeting_external_participants/);
  // attendance keeps a mandatory FK to users
  assert.match(schema, /userId: uuid\("user_id"\)\s*\.notNull\(\)\s*\.references\(\(\) => users\.id/);
  const actions = readFileSync("lib/actions/staff-meetings.ts", "utf8");
  assert.equal(/insert\(users\)/.test(actions), false, "must not create users");
});

test("migration is additive only (no drops / destructive statements)", () => {
  const sql = readFileSync("drizzle/0012_staff_meeting_category_participants.sql", "utf8");
  assert.equal(/\bDROP\b|(?<!ON )\bDELETE\b|\bTRUNCATE\b/i.test(sql.replace(/--.*$/gm, "")), false);
  assert.match(sql, /participants_explicit" boolean DEFAULT false NOT NULL/);
});

test("admin-only mutation actions stay guarded", () => {
  const src = readFileSync("lib/actions/staff-meetings.ts", "utf8");
  for (const fn of ["createStaffMeeting", "updateStaffMeetingDetails", "saveStaffMeetingAttendance", "deleteStaffMeeting"]) {
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    assert.match(body.slice(0, 500), /requireAdmin\(\)/, fn);
  }
});
