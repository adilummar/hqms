/**
 * Pure (no DB, no framework) helpers for staff FN/AN attendance.
 *
 * All time decisions use the institution timezone (Asia/Kolkata, IST) and are
 * computed from a `Date` supplied by the SERVER. The browser clock is never
 * used to decide whether a session is open or closed.
 *
 * Windows (IST):
 *   FN  06:00 → 14:00   (auto-absent at 14:00)
 *   AN  14:00 → 23:00   (auto-absent at 23:00)
 */

export type StaffSession = "FN" | "AN";
export const STAFF_SESSIONS: readonly StaffSession[] = ["FN", "AN"] as const;

export const STAFF_TIMEZONE = "Asia/Kolkata";

/** Minutes after IST midnight. Open is inclusive, close is exclusive. */
export const SESSION_WINDOWS: Record<StaffSession, { openMin: number; closeMin: number }> = {
  FN: { openMin: 6 * 60, closeMin: 14 * 60 },
  AN: { openMin: 14 * 60, closeMin: 23 * 60 },
};

export const SESSION_LABELS: Record<StaffSession, string> = {
  FN: "Forenoon",
  AN: "Afternoon",
};

export type SessionPhase = "upcoming" | "open" | "closed";

export type RecordStatus = "present" | "absent" | "leave";

/** Display / counting state of a single session cell. */
export type CellStatus =
  | "present"
  | "absent"
  | "leave"
  | "pending" // window is open, no record yet
  | "upcoming" // window has not opened yet
  | "unmarked" // window closed, no record yet (automatic absence not processed)
  | "off"; // non-working session

export type DailyKind =
  | "full_day"
  | "half_day"
  | "full_day_absent"
  | "absent"
  | "leave"
  | "off"
  | "in_progress";

const istParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: STAFF_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsOf(now: Date) {
  const out: Record<string, string> = {};
  for (const p of istParts.formatToParts(now)) out[p.type] = p.value;
  return out;
}

/** IST calendar date as YYYY-MM-DD. */
export function toIstDate(now: Date): string {
  const p = partsOf(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutes elapsed since IST midnight (0–1439), fractional seconds ignored. */
export function istMinutesOfDay(now: Date): number {
  const p = partsOf(now);
  return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
}

/** Seconds elapsed since IST midnight. */
function istSecondsOfDay(now: Date): number {
  const p = partsOf(now);
  return parseInt(p.hour, 10) * 3600 + parseInt(p.minute, 10) * 60 + parseInt(p.second, 10);
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD calendar date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add whole days to a YYYY-MM-DD date. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Inclusive list of dates from `from` to `to` (empty if from > to). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Phase of a session on `date`, evaluated at `now` (IST). */
export function getSessionPhase(session: StaffSession, date: string, now: Date): SessionPhase {
  const today = toIstDate(now);
  if (date > today) return "upcoming";
  if (date < today) return "closed";
  const secs = istSecondsOfDay(now);
  const w = SESSION_WINDOWS[session];
  if (secs < w.openMin * 60) return "upcoming";
  if (secs >= w.closeMin * 60) return "closed";
  return "open";
}

/** The session whose check-in window is open right now, or null. */
export function getActiveSession(now: Date): StaffSession | null {
  const today = toIstDate(now);
  for (const s of STAFF_SESSIONS) {
    if (getSessionPhase(s, today, now) === "open") return s;
  }
  return null;
}

/** Milliseconds until the next window boundary (06:00, 14:00, 23:00 or midnight IST). */
export function msUntilNextBoundary(now: Date): number {
  const secs = istSecondsOfDay(now);
  const boundaries = [
    SESSION_WINDOWS.FN.openMin * 60,
    SESSION_WINDOWS.FN.closeMin * 60,
    SESSION_WINDOWS.AN.closeMin * 60,
    24 * 3600,
  ];
  const next = boundaries.find((b) => b > secs) ?? 24 * 3600;
  return (next - secs) * 1000 - now.getMilliseconds();
}

// ── Off days ────────────────────────────────────────────────────────────────

export interface OffDayRow {
  date: string;
  scope: "both" | "FN" | "AN";
  type: string;
  reason: string | null;
}

export interface OffConfig {
  /** 0 = Sunday … 6 = Saturday */
  weeklyOffDays: number[];
  rows: OffDayRow[];
}

export function parseWeeklyOff(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/** Whether `session` on `date` is a non-working session, and why. */
export function getOffInfo(
  date: string,
  session: StaffSession,
  cfg: OffConfig
): { off: boolean; label: string | null } {
  if (cfg.weeklyOffDays.includes(weekdayOf(date))) {
    return { off: true, label: "Weekly off" };
  }
  const row = cfg.rows.find(
    (r) => r.date === date && (r.scope === "both" || r.scope === session)
  );
  if (row) return { off: true, label: row.reason?.trim() || offTypeLabel(row.type) };
  return { off: false, label: null };
}

export function offTypeLabel(type: string): string {
  switch (type) {
    case "holiday":
      return "Holiday";
    case "students_leave":
      return "Students' leave";
    case "weekly_off":
      return "Weekly off";
    default:
      return "Off day";
  }
}

// ── Status derivation ───────────────────────────────────────────────────────

/**
 * Status of one session cell. A stored record always wins (it is the
 * authoritative fact, including leave and corrections). Without a record,
 * off sessions are "off"; otherwise the phase decides pending/upcoming/unmarked.
 * A session that has not reached its cutoff is NEVER absent.
 */
export function resolveCellStatus(args: {
  phase: SessionPhase;
  record: RecordStatus | null;
  off: boolean;
}): CellStatus {
  if (args.record) return args.record;
  if (args.off) return "off";
  if (args.phase === "upcoming") return "upcoming";
  if (args.phase === "open") return "pending";
  return "unmarked";
}

/**
 * Combine the FN and AN cells into one daily result.
 *
 *  FN present + AN present          → full_day
 *  exactly one present              → half_day
 *  both absent                      → full_day_absent
 *  any pending / upcoming / unmarked→ in_progress (never counted as absent)
 *  leave on every working session   → leave
 *  both sessions off                → off
 *
 * A session that is off is ignored: present on the only working session is a
 * full day; absent on the only working session is a full-day absence.
 */
export function deriveDailyKind(fn: CellStatus, an: CellStatus): DailyKind {
  const working = [fn, an].filter((c) => c !== "off");
  if (working.length === 0) return "off";
  if (working.some((c) => c === "pending" || c === "upcoming" || c === "unmarked")) {
    return "in_progress";
  }
  const present = working.filter((c) => c === "present").length;
  const absent = working.filter((c) => c === "absent").length;
  const leave = working.filter((c) => c === "leave").length;

  if (leave === working.length) return "leave";
  if (present === working.length) return "full_day";
  if (present >= 1) return "half_day";
  if (absent === working.length) return "full_day_absent";
  return "absent"; // absent + leave, nobody present
}

/** Rounded percentage, or null when there is nothing to measure. */
export function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export interface SessionTally {
  fnPresent: number;
  fnAbsent: number;
  fnLeave: number;
  anPresent: number;
  anAbsent: number;
  anLeave: number;
  fullDays: number;
  halfDays: number;
  fullDaysAbsent: number;
  absentDays: number; // absent + leave, nobody present
  leaveDays: number;
}

export function emptyTally(): SessionTally {
  return {
    fnPresent: 0,
    fnAbsent: 0,
    fnLeave: 0,
    anPresent: 0,
    anAbsent: 0,
    anLeave: 0,
    fullDays: 0,
    halfDays: 0,
    fullDaysAbsent: 0,
    absentDays: 0,
    leaveDays: 0,
  };
}

/** Add one day's cells and combined result to a running tally (pending/off are not counted). */
export function addToTally(t: SessionTally, fn: CellStatus, an: CellStatus, kind: DailyKind) {
  if (fn === "present") t.fnPresent++;
  else if (fn === "absent") t.fnAbsent++;
  else if (fn === "leave") t.fnLeave++;
  if (an === "present") t.anPresent++;
  else if (an === "absent") t.anAbsent++;
  else if (an === "leave") t.anLeave++;

  if (kind === "full_day") t.fullDays++;
  else if (kind === "half_day") t.halfDays++;
  else if (kind === "full_day_absent") t.fullDaysAbsent++;
  else if (kind === "absent") t.absentDays++;
  else if (kind === "leave") t.leaveDays++;
}

/** Session-based attendance %: present sessions / (present + absent sessions). Leave and off are excluded. */
export function sessionRate(t: SessionTally): number | null {
  const present = t.fnPresent + t.anPresent;
  const absent = t.fnAbsent + t.anAbsent;
  return percent(present, present + absent);
}

/** Full-day attendance %: full days / (all days with a final, non-leave, non-off result). */
export function fullDayRate(t: SessionTally): number | null {
  return percent(t.fullDays, t.fullDays + t.halfDays + t.fullDaysAbsent + t.absentDays);
}
