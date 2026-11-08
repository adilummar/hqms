import { db } from "@/lib/db";
import { settings, staffAttendance, staffOffDays } from "@/lib/db/schema";
import { and, between, eq, isNotNull } from "drizzle-orm";
import { getHifzTutors } from "@/lib/services/hifz-tutors";
import {
  STAFF_SESSIONS,
  addDays,
  dateRange,
  getOffInfo,
  getSessionPhase,
  parseWeeklyOff,
  toIstDate,
  type OffConfig,
  type OffDayRow,
} from "@/lib/services/staff-sessions";

export const SESSION_START_KEY = "staff_session_start_date";
export const WEEKLY_OFF_KEY = "staff_weekly_off_days";

/**
 * First IST date that uses FN/AN attendance. Earlier dates are legacy
 * single-session records. Returns null if the migration has not been applied
 * (then everything is treated as legacy and nothing is auto-marked).
 */
export async function getSessionStartDate(): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, SESSION_START_KEY),
    columns: { value: true },
  });
  const v = row?.value?.trim();
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function getWeeklyOffDays(): Promise<number[]> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, WEEKLY_OFF_KEY),
    columns: { value: true },
  });
  return parseWeeklyOff(row?.value);
}

/** Weekly-off setting plus the off-day rows overlapping [from, to]. */
export async function getOffConfig(from: string, to: string): Promise<OffConfig> {
  const [weeklyOffDays, rows] = await Promise.all([
    getWeeklyOffDays(),
    db
      .select({
        date: staffOffDays.date,
        scope: staffOffDays.scope,
        type: staffOffDays.type,
        reason: staffOffDays.reason,
      })
      .from(staffOffDays)
      .where(between(staffOffDays.date, from, to)),
  ]);
  return {
    weeklyOffDays,
    rows: rows.map((r): OffDayRow => ({
      date: r.date,
      scope: r.scope === "FN" || r.scope === "AN" ? r.scope : "both",
      type: r.type,
      reason: r.reason,
    })),
  };
}

export interface AbsenceRunResult {
  skipped?: string;
  today: string;
  from: string | null;
  eligibleTutors: number;
  created: number;
  details: { date: string; session: string; created: number }[];
}

/**
 * Authoritative automatic-absence processor.
 *
 * For every FN/AN session whose cutoff has passed (looking back `lookbackDays`
 * IST days, never before the FN/AN start date) it inserts an ABSENT row
 * (source = 'auto') for each eligible Hifz tutor that has no record yet.
 *
 *  - Idempotent: INSERT … ON CONFLICT DO NOTHING on (user, date, session), so
 *    running it twice, concurrently, or after a check-in changes nothing.
 *  - Never overwrites an existing row (present / leave / admin-corrected).
 *  - Skips non-working sessions (weekly off, holidays, students' leave).
 *  - Self-healing: a missed run is covered by the next run's lookback.
 */
export async function processStaffSessionAbsences(
  now: Date = new Date(),
  lookbackDays = 2
): Promise<AbsenceRunResult> {
  const today = toIstDate(now);
  const base: AbsenceRunResult = {
    today,
    from: null,
    eligibleTutors: 0,
    created: 0,
    details: [],
  };

  const start = await getSessionStartDate();
  if (!start) return { ...base, skipped: "staff_session_start_date not configured" };

  const lookbackFrom = addDays(today, -Math.max(0, Math.min(lookbackDays, 31)));
  const from = lookbackFrom > start ? lookbackFrom : start;
  if (from > today) return { ...base, from, skipped: "FN/AN not started yet" };

  const tutors = await getHifzTutors();
  if (tutors.length === 0) return { ...base, from, skipped: "no eligible Hifz tutors" };

  const offCfg = await getOffConfig(from, today);

  for (const date of dateRange(from, today)) {
    for (const session of STAFF_SESSIONS) {
      if (getSessionPhase(session, date, now) !== "closed") continue;
      if (getOffInfo(date, session, offCfg).off) continue;

      const existing = await db
        .select({ userId: staffAttendance.userId })
        .from(staffAttendance)
        .where(
          and(
            eq(staffAttendance.date, date),
            eq(staffAttendance.session, session),
            isNotNull(staffAttendance.session)
          )
        );
      const have = new Set(existing.map((r) => r.userId));
      const missing = tutors.filter((t) => !have.has(t.id));
      if (missing.length === 0) continue;

      const inserted = await db
        .insert(staffAttendance)
        .values(
          missing.map((t) => ({
            userId: t.id,
            date,
            session,
            status: "absent" as const,
            remarks: "Automatic absence: no check-in before session cutoff",
            // recorded_by is NOT NULL → the tutor's own id; source = 'auto' marks it as system-generated.
            recordedBy: t.id,
            source: "auto",
            createdAt: now,
            updatedAt: now,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: staffAttendance.id });

      base.created += inserted.length;
      base.details.push({ date, session, created: inserted.length });
    }
  }

  return { ...base, from, eligibleTutors: tutors.length };
}
