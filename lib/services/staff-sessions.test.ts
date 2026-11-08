import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getActiveSession,
  getSessionPhase,
  toIstDate,
  msUntilNextBoundary,
  resolveCellStatus,
  deriveDailyKind,
  getOffInfo,
  parseWeeklyOff,
  weekdayOf,
  addDays,
  dateRange,
  emptyTally,
  addToTally,
  sessionRate,
  fullDayRate,
} from "./staff-sessions";

// IST = UTC+5:30, so IST HH:MM → UTC HH:MM - 5:30.
const ist = (date: string, hm: string, sec = 0) => {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCMinutes(h * 60 + m - 330, sec);
  return d;
};

test("IST date is used, not UTC", () => {
  // 2026-11-09 01:00 IST = 2026-11-08 19:30 UTC
  assert.equal(toIstDate(ist("2026-11-09", "01:00")), "2026-11-09");
  assert.equal(toIstDate(ist("2026-11-09", "23:59")), "2026-11-09");
});

test("FN window: closed before 06:00, open 06:00–13:59:59, closed from 14:00", () => {
  const d = "2026-11-09";
  assert.equal(getSessionPhase("FN", d, ist(d, "05:59", 59)), "upcoming");
  assert.equal(getSessionPhase("FN", d, ist(d, "06:00")), "open");
  assert.equal(getSessionPhase("FN", d, ist(d, "13:59", 59)), "open");
  assert.equal(getSessionPhase("FN", d, ist(d, "14:00")), "closed");
});

test("AN window: upcoming before 14:00, open 14:00–22:59:59, closed from 23:00", () => {
  const d = "2026-11-09";
  assert.equal(getSessionPhase("AN", d, ist(d, "13:59", 59)), "upcoming");
  assert.equal(getSessionPhase("AN", d, ist(d, "14:00")), "open");
  assert.equal(getSessionPhase("AN", d, ist(d, "22:59", 59)), "open");
  assert.equal(getSessionPhase("AN", d, ist(d, "23:00")), "closed");
});

test("active session by time", () => {
  const d = "2026-11-09";
  assert.equal(getActiveSession(ist(d, "05:00")), null);
  assert.equal(getActiveSession(ist(d, "09:10")), "FN");
  assert.equal(getActiveSession(ist(d, "14:00")), "AN");
  assert.equal(getActiveSession(ist(d, "22:59")), "AN");
  assert.equal(getActiveSession(ist(d, "23:00")), null);
});

test("past dates are closed, future dates are upcoming", () => {
  const now = ist("2026-11-09", "10:00");
  assert.equal(getSessionPhase("AN", "2026-11-08", now), "closed");
  assert.equal(getSessionPhase("FN", "2026-11-10", now), "upcoming");
});

test("next boundary scheduling", () => {
  const d = "2026-11-09";
  assert.equal(msUntilNextBoundary(ist(d, "13:00")), 60 * 60 * 1000);
  assert.equal(msUntilNextBoundary(ist(d, "23:30")), 30 * 60 * 1000);
});

test("pending sessions are never absent", () => {
  assert.equal(resolveCellStatus({ phase: "open", record: null, off: false }), "pending");
  assert.equal(resolveCellStatus({ phase: "upcoming", record: null, off: false }), "upcoming");
  assert.equal(resolveCellStatus({ phase: "closed", record: null, off: false }), "unmarked");
  assert.equal(resolveCellStatus({ phase: "closed", record: "absent", off: false }), "absent");
  assert.equal(resolveCellStatus({ phase: "closed", record: null, off: true }), "off");
  // a stored record wins over the off flag
  assert.equal(resolveCellStatus({ phase: "closed", record: "absent", off: true }), "absent");
});

test("daily status: full / half / absent", () => {
  assert.equal(deriveDailyKind("present", "present"), "full_day");
  assert.equal(deriveDailyKind("present", "absent"), "half_day");
  assert.equal(deriveDailyKind("absent", "present"), "half_day");
  assert.equal(deriveDailyKind("absent", "absent"), "full_day_absent");
});

test("daily status: pending/unmarked sessions keep the day in progress", () => {
  assert.equal(deriveDailyKind("present", "pending"), "in_progress");
  assert.equal(deriveDailyKind("absent", "upcoming"), "in_progress");
  assert.equal(deriveDailyKind("absent", "unmarked"), "in_progress");
});

test("daily status: leave and off handling", () => {
  assert.equal(deriveDailyKind("leave", "leave"), "leave");
  assert.equal(deriveDailyKind("off", "off"), "off");
  assert.equal(deriveDailyKind("present", "off"), "full_day");
  assert.equal(deriveDailyKind("absent", "off"), "full_day_absent");
  assert.equal(deriveDailyKind("present", "leave"), "half_day");
  assert.equal(deriveDailyKind("absent", "leave"), "absent");
});

test("weekly off and off-day rows", () => {
  const cfg = {
    weeklyOffDays: parseWeeklyOff("5"),
    rows: [
      { date: "2026-11-10", scope: "both" as const, type: "holiday", reason: "Eid" },
      { date: "2026-11-11", scope: "AN" as const, type: "other", reason: null },
    ],
  };
  // 2026-11-13 is a Friday
  assert.equal(weekdayOf("2026-11-13"), 5);
  assert.deepEqual(getOffInfo("2026-11-13", "FN", cfg), { off: true, label: "Weekly off" });
  assert.deepEqual(getOffInfo("2026-11-10", "FN", cfg), { off: true, label: "Eid" });
  assert.equal(getOffInfo("2026-11-11", "FN", cfg).off, false);
  assert.equal(getOffInfo("2026-11-11", "AN", cfg).off, true);
  assert.equal(getOffInfo("2026-11-09", "FN", cfg).off, false);
  assert.deepEqual(parseWeeklyOff(""), []);
  assert.deepEqual(parseWeeklyOff("0, 5, x, 9"), [0, 5]);
});

test("date helpers", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.deepEqual(dateRange("2026-11-08", "2026-11-10"), ["2026-11-08", "2026-11-09", "2026-11-10"]);
  assert.deepEqual(dateRange("2026-11-10", "2026-11-08"), []);
});

test("tally keeps FN and AN separate and excludes leave/off from rates", () => {
  const t = emptyTally();
  addToTally(t, "present", "present", deriveDailyKind("present", "present")); // full
  addToTally(t, "present", "absent", deriveDailyKind("present", "absent")); // half
  addToTally(t, "absent", "absent", deriveDailyKind("absent", "absent")); // full absent
  addToTally(t, "leave", "leave", deriveDailyKind("leave", "leave")); // leave
  addToTally(t, "off", "off", deriveDailyKind("off", "off")); // off
  addToTally(t, "present", "pending", deriveDailyKind("present", "pending")); // in progress
  assert.equal(t.fnPresent, 3);
  assert.equal(t.fnAbsent, 1);
  assert.equal(t.anPresent, 1);
  assert.equal(t.anAbsent, 2);
  assert.equal(t.fnLeave, 1);
  assert.equal(t.fullDays, 1);
  assert.equal(t.halfDays, 1);
  assert.equal(t.fullDaysAbsent, 1);
  assert.equal(t.leaveDays, 1);
  // sessions: present 4, absent 3 → 57%
  assert.equal(sessionRate(t), 57);
  // days: 1 full of 3 counted → 33%
  assert.equal(fullDayRate(t), 33);
  assert.equal(sessionRate(emptyTally()), null);
});
