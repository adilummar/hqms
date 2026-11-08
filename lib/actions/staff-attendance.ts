"use server";

import { db } from "@/lib/db";
import { staffAttendance } from "@/lib/db/schema";
import { and, between, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth/helpers";
import { logActivity } from "@/lib/actions/activity";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getHifzTutors, isHifzTutor } from "@/lib/services/hifz-tutors";
import {
  getOffConfig,
  getSessionStartDate,
} from "@/lib/services/staff-attendance-data";
import {
  STAFF_SESSIONS,
  SESSION_WINDOWS,
  addToTally,
  deriveDailyKind,
  emptyTally,
  fullDayRate,
  getActiveSession,
  getOffInfo,
  getSessionPhase,
  istMinutesOfDay,
  msUntilNextBoundary,
  resolveCellStatus,
  sessionRate,
  toIstDate,
  type CellStatus,
  type DailyKind,
  type OffConfig,
  type RecordStatus,
  type SessionTally,
  type StaffSession,
} from "@/lib/services/staff-sessions";

// ── Types shared with the UI ────────────────────────────────────────────────

export interface SessionCell {
  status: CellStatus;
  time: string | null;
  source: string | null; // 'self' | 'auto' | 'admin'
  corrected: boolean;
  originalStatus: string | null;
  originalSource: string | null;
  remarks: string | null;
  leaveType: string | null;
  offLabel: string | null;
}

export interface DailyStaffRow {
  userId: string;
  username: string;
  email: string | null;
  fn: SessionCell;
  an: SessionCell;
  kind: DailyKind;
  /** Only for legacy (pre-FN/AN) dates. */
  legacy: {
    status: RecordStatus | "unmarked";
    time: string | null;
    remarks: string | null;
    leaveType: string | null;
    recordedBy: string | null;
    hasRecord: boolean;
  } | null;
}

export interface DailyAttendanceData {
  selectedDate: string;
  todayDate: string;
  isLegacyDate: boolean;
  sessionStartDate: string | null;
  totalStaff: number;
  tally: SessionTally;
  inProgress: number;
  offLabel: string | null; // set when the whole day is off
  // legacy-date counters
  legacyPresent: number;
  legacyAbsent: number;
  legacyLeave: number;
  staffRows: DailyStaffRow[];
}

export interface MonthlyDayCell {
  day: number;
  date: string;
  isLegacy: boolean;
  fn: CellStatus | null;
  an: CellStatus | null;
  kind: DailyKind | null;
  legacyStatus: "present" | "absent" | "leave" | "future" | null;
  offLabel: string | null;
}

export interface MonthlyStaffRow {
  userId: string;
  username: string;
  email: string | null;
  daysData: MonthlyDayCell[];
  tally: SessionTally;
  sessionRate: number | null;
  fullDayRate: number | null;
  legacyPresent: number;
  legacyAbsent: number;
  legacyLeave: number;
}

export interface MonthlyAttendanceData {
  year: number;
  month: number;
  monthName: string;
  days: number[];
  todayDate: string;
  sessionStartDate: string | null;
  hasLegacyDays: boolean;
  hasSessionDays: boolean;
  totalStaff: number;
  avgSessionRate: number | null;
  avgFullDayRate: number | null;
  staffMatrix: MonthlyStaffRow[];
}

export interface StaffCheckInStatus {
  isStaff: boolean;
  date: string | null;
  mode: "sessions" | "legacy" | null;
  activeSession: StaffSession | null;
  offLabel: string | null;
  sessions: Record<StaffSession, { status: CellStatus; time: string | null }> | null;
  legacy: { checkedIn: boolean; time: string | null } | null;
  msToNextBoundary: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeString(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

type StaffAttendanceRow = typeof staffAttendance.$inferSelect;

function buildCell(
  session: StaffSession,
  date: string,
  now: Date,
  rec: StaffAttendanceRow | undefined,
  offCfg: OffConfig
): SessionCell {
  const off = getOffInfo(date, session, offCfg);
  const status = resolveCellStatus({
    phase: getSessionPhase(session, date, now),
    record: rec?.status ?? null,
    off: off.off,
  });
  return {
    status,
    time: rec?.checkInAt && rec.status === "present" ? formatTimeString(rec.checkInAt) : null,
    source: rec?.source ?? null,
    corrected: !!rec?.correctedAt,
    originalStatus: rec?.originalStatus ?? null,
    originalSource: rec?.originalSource ?? null,
    remarks: rec?.remarks ?? null,
    leaveType: rec?.leaveType ?? null,
    offLabel: off.off ? off.label : null,
  };
}

function revalidateStaffAttendance() {
  revalidatePath("/");
  revalidatePath("/tutor");
  revalidatePath("/admin/attendance/staff");
  revalidatePath("/admin/reports/attendance");
}

// ── Tutor: check-in ─────────────────────────────────────────────────────────

/** Check-in state for the signed-in user (only eligible Hifz tutors are "staff"). */
export async function getStaffCheckInStatus(): Promise<StaffCheckInStatus> {
  const none: StaffCheckInStatus = {
    isStaff: false,
    date: null,
    mode: null,
    activeSession: null,
    offLabel: null,
    sessions: null,
    legacy: null,
    msToNextBoundary: 60_000,
  };

  const session = await auth();
  if (!session?.user) return none;
  if (session.user.role !== "tutor") return none;
  if (!(await isHifzTutor(session.user.id))) return none;

  const now = new Date();
  const today = toIstDate(now);
  const start = await getSessionStartDate();
  const msToNextBoundary = msUntilNextBoundary(now);

  const rows = await db.query.staffAttendance.findMany({
    where: and(eq(staffAttendance.userId, session.user.id), eq(staffAttendance.date, today)),
  });

  if (!start || today < start) {
    const rec = rows.find((r) => r.session === null);
    return {
      ...none,
      isStaff: true,
      date: today,
      mode: "legacy",
      legacy: {
        checkedIn: rec?.status === "present",
        time: rec && rec.status === "present" ? formatTimeString(rec.createdAt) : null,
      },
      msToNextBoundary,
    };
  }

  const offCfg = await getOffConfig(today, today);
  const cells = Object.fromEntries(
    STAFF_SESSIONS.map((s) => {
      const c = buildCell(s, today, now, rows.find((r) => r.session === s), offCfg);
      return [s, { status: c.status, time: c.time }];
    })
  ) as Record<StaffSession, { status: CellStatus; time: string | null }>;

  const active = getActiveSession(now);
  const offLabel = active ? getOffInfo(today, active, offCfg).label : null;

  return {
    isStaff: true,
    date: today,
    mode: "sessions",
    activeSession: active,
    offLabel,
    sessions: cells,
    legacy: null,
    msToNextBoundary,
  };
}

/** Self check-in for the session that is open right now (server clock, IST). */
export async function checkInStaff(
  remarks?: string
): Promise<{ success: boolean; error?: string; checkInTime?: string; session?: StaffSession | null }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not signed in" };
  if (session.user.role !== "tutor" || !(await isHifzTutor(session.user.id))) {
    return { success: false, error: "Attendance check-in is only for Hifz tutors" };
  }

  const userId = session.user.id;
  const now = new Date();
  const today = toIstDate(now);
  const start = await getSessionStartDate();
  const note = remarks?.trim() || "Self check-in";

  // ── Legacy single-session mode (before the FN/AN start date) ──
  if (!start || today < start) {
    const [created] = await db
      .insert(staffAttendance)
      .values({
        userId,
        date: today,
        session: null,
        status: "present",
        remarks: note,
        recordedBy: userId,
        source: "self",
        checkInAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      const existing = await db.query.staffAttendance.findFirst({
        where: and(
          eq(staffAttendance.userId, userId),
          eq(staffAttendance.date, today),
          isNull(staffAttendance.session)
        ),
      });
      if (existing?.status === "present") {
        return { success: false, error: `Already checked in today at ${formatTimeString(existing.createdAt)}` };
      }
      return { success: false, error: "Today's attendance is already recorded. Contact an admin to change it." };
    }
    await logActivity(userId, "staff_attendance.check_in", "staff_attendance", created.id, {
      date: today,
      time: formatTimeString(now),
    });
    revalidateStaffAttendance();
    return { success: true, checkInTime: formatTimeString(now), session: null };
  }

  // ── FN / AN mode ──
  const active = getActiveSession(now);
  if (!active) {
    return {
      success: false,
      error:
        istMinutesOfDay(now) < SESSION_WINDOWS.FN.openMin
          ? "FN check-in opens at 6:00 AM"
          : "Check-in is closed for today. Contact an admin if you need a correction.",
    };
  }

  const offCfg = await getOffConfig(today, today);
  const off = getOffInfo(today, active, offCfg);
  if (off.off) {
    return { success: false, error: `${active} is an off day (${off.label ?? "non-working"}). Check-in is not required.` };
  }

  // Atomic: the unique key (user, date, session) is the only gate, so two
  // concurrent requests (or cron racing a check-in) cannot create duplicates.
  const [created] = await db
    .insert(staffAttendance)
    .values({
      userId,
      date: today,
      session: active,
      status: "present",
      remarks: note,
      recordedBy: userId,
      source: "self",
      checkInAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    const existing = await db.query.staffAttendance.findFirst({
      where: and(
        eq(staffAttendance.userId, userId),
        eq(staffAttendance.date, today),
        eq(staffAttendance.session, active)
      ),
    });
    if (existing?.status === "present") {
      return {
        success: false,
        error: `${active} already checked in at ${existing.checkInAt ? formatTimeString(existing.checkInAt) : "earlier"}`,
      };
    }
    // absent (automatic or admin) / leave: a tutor can never overwrite it
    return {
      success: false,
      error: `${active} is already recorded as ${existing?.status ?? "closed"}. Only an admin can change it.`,
    };
  }

  await logActivity(userId, "staff_attendance.check_in", "staff_attendance", created.id, {
    date: today,
    session: active,
    time: formatTimeString(now),
  });
  revalidateStaffAttendance();
  return { success: true, checkInTime: formatTimeString(now), session: active };
}

// ── Admin: manual correction ────────────────────────────────────────────────

const adminRecordSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["FN", "AN"]).optional().nullable(),
  status: z.enum(["present", "absent", "leave"]),
  leaveType: z.enum(["sick_leave", "casual_leave", "approved_leave"]).optional().nullable(),
  remarks: z.string().max(255).optional().nullable(),
});

/**
 * Admin / Super Admin marks or corrects one tutor's attendance for one
 * session. Preserves the original status/source of an automatic absence and
 * records who corrected it and when. Audited via activity_logs.
 */
export async function adminRecordStaffAttendance(input: unknown) {
  const adminSession = await requireAdmin();
  const parsed = adminRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }
  const { userId, date, session, status, leaveType, remarks } = parsed.data;

  const now = new Date();
  if (date > toIstDate(now)) {
    return { success: false, error: "Cannot record attendance for a future date" };
  }
  if (!(await isHifzTutor(userId))) {
    return { success: false, error: "Only active Hifz tutors have staff attendance" };
  }

  const start = await getSessionStartDate();
  const legacy = !start || date < start;
  if (!legacy && !session) {
    return { success: false, error: "Select FN or AN" };
  }
  const sessionValue: StaffSession | null = legacy ? null : (session as StaffSession);
  const adminId = adminSession.user.id;
  const cleanLeave = status === "leave" ? leaveType ?? null : null;
  const cleanRemarks = remarks?.trim() || null;

  const sessionWhere = sessionValue
    ? eq(staffAttendance.session, sessionValue)
    : isNull(staffAttendance.session);
  const findExisting = () =>
    db.query.staffAttendance.findFirst({
      where: and(eq(staffAttendance.userId, userId), eq(staffAttendance.date, date), sessionWhere),
    });

  let existing = await findExisting();
  let rowId: string | null = null;

  if (!existing) {
    const [created] = await db
      .insert(staffAttendance)
      .values({
        userId,
        date,
        session: sessionValue,
        status,
        leaveType: cleanLeave,
        remarks: cleanRemarks,
        recordedBy: adminId,
        source: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      rowId = created.id;
      await logActivity(adminId, "staff_attendance.admin_record", "staff_attendance", created.id, {
        userId,
        date,
        session: sessionValue,
        to: status,
        leaveType: cleanLeave,
        remarks: cleanRemarks,
      });
    } else {
      // lost a race with cron / check-in → fall through to the correction path
      existing = await findExisting();
    }
  }

  if (existing) {
    const [updated] = await db
      .update(staffAttendance)
      .set({
        status,
        leaveType: cleanLeave,
        remarks: cleanRemarks,
        recordedBy: adminId,
        source: "admin",
        // keep the ORIGINAL status/source (e.g. the automatic absence) across later corrections
        originalStatus: existing.originalStatus ?? existing.status,
        originalSource: existing.originalSource ?? existing.source,
        correctedBy: adminId,
        correctedAt: now,
        updatedAt: now,
      })
      .where(eq(staffAttendance.id, existing.id))
      .returning();
    rowId = updated.id;
    await logActivity(adminId, "staff_attendance.admin_correct", "staff_attendance", updated.id, {
      userId,
      date,
      session: sessionValue,
      from: existing.status,
      fromSource: existing.source,
      to: status,
      leaveType: cleanLeave,
      remarks: cleanRemarks,
    });
  }

  revalidateStaffAttendance();
  return { success: true, id: rowId };
}

// ── Admin: daily report ─────────────────────────────────────────────────────

export async function getStaffDailyAttendanceData(dateStr?: string): Promise<DailyAttendanceData> {
  await requireAdmin();
  const now = new Date();
  const todayDate = toIstDate(now);
  const selectedDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayDate;

  const [tutors, start] = await Promise.all([getHifzTutors(), getSessionStartDate()]);
  const isLegacyDate = !start || selectedDate < start;
  const offCfg = await getOffConfig(selectedDate, selectedDate);

  const records =
    tutors.length === 0
      ? []
      : await db.query.staffAttendance.findMany({
          where: and(
            eq(staffAttendance.date, selectedDate),
            inArray(staffAttendance.userId, tutors.map((t) => t.id))
          ),
          with: { recordedByUser: { columns: { username: true } } },
        });

  const tally = emptyTally();
  let inProgress = 0;
  let legacyPresent = 0;
  let legacyAbsent = 0;
  let legacyLeave = 0;

  const staffRows: DailyStaffRow[] = tutors.map((t) => {
    const mine = records.filter((r) => r.userId === t.id);
    const fnRec = mine.find((r) => r.session === "FN");
    const anRec = mine.find((r) => r.session === "AN");
    const fn = buildCell("FN", selectedDate, now, fnRec, offCfg);
    const an = buildCell("AN", selectedDate, now, anRec, offCfg);
    const kind = deriveDailyKind(fn.status, an.status);

    let legacy: DailyStaffRow["legacy"] = null;
    if (isLegacyDate) {
      const rec = mine.find((r) => r.session === null);
      const status: RecordStatus | "unmarked" =
        rec?.status ?? (selectedDate <= todayDate ? "absent" : "unmarked");
      if (status === "present") legacyPresent++;
      else if (status === "leave") legacyLeave++;
      else if (status === "absent") legacyAbsent++;
      legacy = {
        status,
        time: rec && rec.status === "present" ? formatTimeString(rec.createdAt) : null,
        remarks: rec?.remarks ?? null,
        leaveType: rec?.leaveType ?? null,
        recordedBy: rec?.recordedByUser?.username ?? null,
        hasRecord: !!rec,
      };
    } else {
      addToTally(tally, fn.status, an.status, kind);
      if (kind === "in_progress") inProgress++;
    }

    return {
      userId: t.id,
      username: t.username,
      email: t.email,
      fn,
      an,
      kind,
      legacy,
    };
  });

  const wholeDayOff =
    getOffInfo(selectedDate, "FN", offCfg).off && getOffInfo(selectedDate, "AN", offCfg).off
      ? getOffInfo(selectedDate, "FN", offCfg).label
      : null;

  return {
    selectedDate,
    todayDate,
    isLegacyDate,
    sessionStartDate: start,
    totalStaff: staffRows.length,
    tally,
    inProgress,
    offLabel: wholeDayOff,
    legacyPresent,
    legacyAbsent,
    legacyLeave,
    staffRows,
  };
}

// ── Admin: monthly matrix ───────────────────────────────────────────────────

export async function getStaffMonthlyAttendanceData(
  yearInput?: number,
  monthInput?: number
): Promise<MonthlyAttendanceData> {
  await requireAdmin();

  const now = new Date();
  const todayDate = toIstDate(now);
  const [todayY, todayM] = todayDate.split("-").map(Number);
  const year = yearInput ?? todayY;
  const month = monthInput ?? todayM;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);

  const [tutors, start] = await Promise.all([getHifzTutors(), getSessionStartDate()]);
  const offCfg = await getOffConfig(monthStart, monthEnd);

  const records =
    tutors.length === 0
      ? []
      : await db.query.staffAttendance.findMany({
          where: and(
            between(staffAttendance.date, monthStart, monthEnd),
            inArray(staffAttendance.userId, tutors.map((t) => t.id))
          ),
        });

  // userId -> date -> { FN, AN, legacy }
  const byUser = new Map<string, Map<string, { FN?: StaffAttendanceRow; AN?: StaffAttendanceRow; legacy?: StaffAttendanceRow }>>();
  for (const r of records) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, new Map());
    const m = byUser.get(r.userId)!;
    const slot = m.get(r.date) ?? {};
    if (r.session === "FN") slot.FN = r;
    else if (r.session === "AN") slot.AN = r;
    else slot.legacy = r;
    m.set(r.date, slot);
  }

  let hasLegacyDays = false;
  let hasSessionDays = false;

  const staffMatrix: MonthlyStaffRow[] = tutors.map((t) => {
    const tally = emptyTally();
    let legacyPresent = 0;
    let legacyAbsent = 0;
    let legacyLeave = 0;
    const userDays = byUser.get(t.id) ?? new Map();

    const daysData = days.map((d): MonthlyDayCell => {
      const date = `${year}-${pad(month)}-${pad(d)}`;
      const slot = userDays.get(date) ?? {};
      const isLegacy = !start || date < start;

      if (isLegacy) {
        hasLegacyDays = true;
        const rec = slot.legacy;
        let legacyStatus: MonthlyDayCell["legacyStatus"];
        if (rec) legacyStatus = rec.status;
        else if (date > todayDate) legacyStatus = "future";
        else legacyStatus = "absent"; // unchanged legacy semantics: no record on a past day = absent
        if (legacyStatus === "present") legacyPresent++;
        else if (legacyStatus === "absent") legacyAbsent++;
        else if (legacyStatus === "leave") legacyLeave++;
        return { day: d, date, isLegacy: true, fn: null, an: null, kind: null, legacyStatus, offLabel: null };
      }

      hasSessionDays = true;
      const fn = buildCell("FN", date, now, slot.FN, offCfg);
      const an = buildCell("AN", date, now, slot.AN, offCfg);
      const kind = deriveDailyKind(fn.status, an.status);
      addToTally(tally, fn.status, an.status, kind);
      return {
        day: d,
        date,
        isLegacy: false,
        fn: fn.status,
        an: an.status,
        kind,
        legacyStatus: null,
        offLabel: fn.offLabel ?? an.offLabel,
      };
    });

    return {
      userId: t.id,
      username: t.username,
      email: t.email,
      daysData,
      tally,
      sessionRate: sessionRate(tally),
      fullDayRate: fullDayRate(tally),
      legacyPresent,
      legacyAbsent,
      legacyLeave,
    };
  });

  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  return {
    year,
    month,
    monthName: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }),
    days,
    todayDate,
    sessionStartDate: start,
    hasLegacyDays,
    hasSessionDays,
    totalStaff: staffMatrix.length,
    avgSessionRate: avg(staffMatrix.map((r) => r.sessionRate)),
    avgFullDayRate: avg(staffMatrix.map((r) => r.fullDayRate)),
    staffMatrix,
  };
}
