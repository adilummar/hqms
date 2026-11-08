"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import {
  adminRecordStaffAttendance,
  type DailyAttendanceData,
  type DailyStaffRow,
  type MonthlyAttendanceData,
  type SessionCell,
} from "@/lib/actions/staff-attendance";
import type { OffDaySettings } from "@/lib/actions/staff-off-days";
import { StaffOffDaysPanel } from "@/components/staff-attendance/staff-off-days-panel";
import { addDays, type CellStatus, type DailyKind, type StaffSession } from "@/lib/services/staff-sessions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  viewMode: "daily" | "monthly";
  dailyData?: DailyAttendanceData;
  monthlyData?: MonthlyAttendanceData;
  offSettings: OffDaySettings;
}

// ── Presentation maps ───────────────────────────────────────────────────────

const CELL_STYLE: Record<CellStatus, { label: string; cls: string }> = {
  present: { label: "Present", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  absent: { label: "Absent", cls: "bg-red-50 border-red-200 text-red-700" },
  leave: { label: "Leave", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  pending: { label: "Pending", cls: "bg-sky-50 border-sky-200 text-sky-700" },
  upcoming: { label: "Not started", cls: "bg-slate-50 border-slate-200 text-slate-500" },
  unmarked: { label: "Awaiting auto-absence", cls: "bg-orange-50 border-orange-200 text-orange-700" },
  off: { label: "Off day", cls: "bg-slate-100 border-slate-200 text-slate-600" },
};

const KIND_STYLE: Record<DailyKind, { label: string; cls: string }> = {
  full_day: { label: "Full Day", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  half_day: { label: "Half Day", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  full_day_absent: { label: "Full Day Absent", cls: "bg-red-50 border-red-200 text-red-700" },
  absent: { label: "Absent", cls: "bg-red-50 border-red-200 text-red-700" },
  leave: { label: "Leave", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  off: { label: "Off day", cls: "bg-slate-100 border-slate-200 text-slate-600" },
  in_progress: { label: "In progress", cls: "bg-sky-50 border-sky-200 text-sky-700" },
};

const MATRIX_LETTER: Record<CellStatus, string> = {
  present: "P",
  absent: "A",
  leave: "L",
  pending: "·",
  upcoming: "·",
  unmarked: "?",
  off: "O",
};

const MATRIX_CLS: Record<CellStatus, string> = {
  present: "text-emerald-700 bg-emerald-500/15 font-bold",
  absent: "text-red-700 bg-red-500/10 font-medium",
  leave: "text-amber-800 bg-amber-500/15 font-medium",
  pending: "text-sky-600",
  upcoming: "text-muted-foreground/40",
  unmarked: "text-orange-600 bg-orange-500/10",
  off: "text-slate-500 bg-slate-500/10",
};

function pctText(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

function rateCls(v: number | null) {
  if (v === null) return "bg-muted text-muted-foreground border border-border";
  if (v >= 85) return "bg-emerald-50 text-emerald-800 border border-emerald-200";
  if (v >= 70) return "bg-amber-50 text-amber-800 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

function StatusBadge({ cell }: { cell: SessionCell }) {
  const s = CELL_STYLE[cell.status];
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold",
          s.cls
        )}
        title={cell.offLabel ?? undefined}
      >
        {cell.status === "off" && cell.offLabel ? cell.offLabel : s.label}
      </span>
      {cell.source === "auto" && cell.status === "absent" && (
        <span className="text-[10px] text-muted-foreground">Auto-recorded</span>
      )}
      {cell.corrected && (
        <span
          className="text-[10px] text-indigo-600"
          title={`Original: ${cell.originalStatus ?? "?"}${cell.originalSource === "auto" ? " (automatic)" : ""}`}
        >
          Corrected{cell.originalStatus ? ` from ${cell.originalStatus}${cell.originalSource === "auto" ? " (auto)" : ""}` : ""}
        </span>
      )}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

interface EditTarget {
  row: DailyStaffRow;
  session: StaffSession | null; // null = legacy single-session date
}

export function AdminStaffAttendanceView({
  viewMode: initialViewMode,
  dailyData,
  monthlyData,
  offSettings,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"daily" | "monthly">(initialViewMode);

  // Edit modal state
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editStatus, setEditStatus] = useState<"present" | "absent" | "leave">("present");
  const [editLeaveType, setEditLeaveType] = useState<string>("casual_leave");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function updateQuery(params: Record<string, string | number | undefined>) {
    const current = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) current.set(key, String(value));
      else current.delete(key);
    }
    router.push(`/admin/attendance/staff?${current.toString()}`);
  }

  function handleTabChange(tab: "daily" | "monthly") {
    setActiveTab(tab);
    updateQuery({ view: tab });
  }

  function handleDateChange(dateStr: string) {
    if (!dateStr) return;
    updateQuery({ date: dateStr, view: "daily" });
  }

  function stepDate(days: number) {
    if (!dailyData) return;
    handleDateChange(addDays(dailyData.selectedDate, days));
  }

  function stepMonth(delta: number) {
    if (!monthlyData) return;
    let newMonth = monthlyData.month + delta;
    let newYear = monthlyData.year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    updateQuery({ month: newMonth, year: newYear, view: "monthly" });
  }

  function cellFor(row: DailyStaffRow, session: StaffSession): SessionCell {
    return session === "FN" ? row.fn : row.an;
  }

  function loadFields(row: DailyStaffRow, session: StaffSession | null) {
    if (session === null) {
      const l = row.legacy;
      setEditStatus(l && l.status !== "unmarked" ? l.status : "present");
      setEditLeaveType(l?.leaveType || "casual_leave");
      setEditRemarks(l?.remarks || "");
      return;
    }
    const c = cellFor(row, session);
    setEditStatus(c.status === "present" || c.status === "absent" || c.status === "leave" ? c.status : "present");
    setEditLeaveType(c.leaveType || "casual_leave");
    setEditRemarks(c.status === "present" || c.status === "absent" || c.status === "leave" ? c.remarks || "" : "");
  }

  function openEdit(row: DailyStaffRow, session: StaffSession | null) {
    setEditing({ row, session });
    loadFields(row, session);
  }

  function switchSession(session: StaffSession) {
    if (!editing) return;
    setEditing({ ...editing, session });
    loadFields(editing.row, session);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !dailyData) return;

    startTransition(async () => {
      const result = await adminRecordStaffAttendance({
        userId: editing.row.userId,
        date: dailyData.selectedDate,
        session: editing.session,
        status: editStatus,
        leaveType: editStatus === "leave" ? editLeaveType : null,
        remarks: editRemarks.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Updated attendance for ${editing.row.username}`);
        setEditing(null);
        router.refresh();
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Failed to update attendance");
      }
    });
  }

  const editingCell =
    editing && editing.session ? cellFor(editing.row, editing.session) : null;

  return (
    <div className="space-y-6">
      {/* ── Top Controls Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-2xs print:hidden">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg">
          {(["daily", "monthly"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer font-dm-sans",
                activeTab === tab
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "daily" ? <Calendar size={14} /> : <CalendarDays size={14} />}
              <span>{tab === "daily" ? "Daily Report" : "Monthly Matrix"}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === "daily" && dailyData && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => stepDate(-1)}
                className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft size={14} />
              </button>
              <input
                type="date"
                value={dailyData.selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-jetbrains"
              />
              <button
                onClick={() => stepDate(1)}
                className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => handleDateChange(dailyData.todayDate)}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer font-dm-sans ml-1"
              >
                Today
              </button>
            </div>
          )}

          {activeTab === "monthly" && monthlyData && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => stepMonth(-1)}
                className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={14} />
              </button>
              <select
                value={monthlyData.month}
                onChange={(e) => updateQuery({ month: parseInt(e.target.value, 10), view: "monthly" })}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(Date.UTC(2025, m - 1, 1)).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={monthlyData.year}
                onChange={(e) => updateQuery({ year: parseInt(e.target.value, 10), view: "monthly" })}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-jetbrains"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={() => stepMonth(1)}
                className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer ml-auto"
            title="Print this report"
          >
            <Printer size={13} />
            <span className="hidden md:inline font-dm-sans">Print</span>
          </button>
        </div>
      </div>

      <StaffOffDaysPanel settings={offSettings} />

      {/* ── DAILY VIEW ──────────────────────────────────────────────── */}
      {activeTab === "daily" && dailyData && (
        <div className="space-y-6">
          {dailyData.isLegacyDate ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 font-dm-sans">
              This date is before the FN/AN system
              {dailyData.sessionStartDate ? ` (started ${dailyData.sessionStartDate})` : ""}. It shows the original
              single daily check-in record, unchanged.
            </div>
          ) : (
            <>
              {dailyData.offLabel && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 font-dm-sans">
                  Off day: <span className="font-semibold">{dailyData.offLabel}</span>. No attendance is expected and
                  no automatic absence is recorded.
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Total Hifz Tutors" value={dailyData.totalStaff} />
                <Stat label="FN Present" value={dailyData.tally.fnPresent} tone="ok" />
                <Stat label="FN Absent" value={dailyData.tally.fnAbsent} tone="bad" />
                <Stat label="AN Present" value={dailyData.tally.anPresent} tone="ok" />
                <Stat label="AN Absent" value={dailyData.tally.anAbsent} tone="bad" />
                <Stat label="Full Day Present" value={dailyData.tally.fullDays} tone="ok" />
                <Stat label="Half Day Present" value={dailyData.tally.halfDays} tone="warn" />
                <Stat label="Full Day Absent" value={dailyData.tally.fullDaysAbsent} tone="bad" />
              </div>
              <p className="text-[11px] text-muted-foreground font-dm-sans -mt-3">
                {dailyData.inProgress} tutor(s) still in progress (a session not yet closed is never counted as
                absent) · {dailyData.tally.fnLeave + dailyData.tally.anLeave} leave session(s) excluded from totals.
              </p>
            </>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground font-inter">
                Hifz Tutors: {dailyData.isLegacyDate ? "Daily Check-In Log" : "FN / AN Attendance"}
              </h3>
              <p className="text-xs text-muted-foreground font-dm-sans">
                Attendance for{" "}
                <span className="font-semibold text-foreground">
                  {new Date(dailyData.selectedDate + "T00:00:00Z").toLocaleDateString("en-IN", {
                    timeZone: "UTC",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>

            <div className="overflow-x-auto">
              {dailyData.isLegacyDate ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-dm-sans">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Tutor</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Check-In Time</th>
                      <th className="px-4 py-3 font-semibold">Remarks / Log</th>
                      <th className="px-4 py-3 font-semibold text-right print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dailyData.staffRows.length === 0 ? (
                      <EmptyRow cols={5} />
                    ) : (
                      dailyData.staffRows.map((row) => {
                        const l = row.legacy!;
                        const st: CellStatus = l.status === "unmarked" ? "upcoming" : l.status;
                        return (
                          <tr key={row.userId} className="hover:bg-muted/20 transition-colors">
                            <TutorCell row={row} />
                            <td className="px-4 py-3.5">
                              <span className={cn("inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold", CELL_STYLE[st].cls)}>
                                {l.status === "absent" && !l.hasRecord ? "Not Checked In" : CELL_STYLE[st].label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-jetbrains">{l.time ?? "—"}</td>
                            <td className="px-4 py-3.5 text-muted-foreground">
                              <p className="max-w-xs truncate text-[11px]">{l.remarks ?? "—"}</p>
                              {l.recordedBy && <p className="text-[10px] text-muted-foreground/70">By: {l.recordedBy}</p>}
                            </td>
                            <td className="px-4 py-3.5 text-right print:hidden">
                              <EditButton onClick={() => openEdit(row, null)} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-dm-sans">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Tutor</th>
                      <th className="px-4 py-3 font-semibold">FN</th>
                      <th className="px-4 py-3 font-semibold">FN Time</th>
                      <th className="px-4 py-3 font-semibold">AN</th>
                      <th className="px-4 py-3 font-semibold">AN Time</th>
                      <th className="px-4 py-3 font-semibold">Daily Status</th>
                      <th className="px-4 py-3 font-semibold text-right print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dailyData.staffRows.length === 0 ? (
                      <EmptyRow cols={7} />
                    ) : (
                      dailyData.staffRows.map((row) => (
                        <tr key={row.userId} className="hover:bg-muted/20 transition-colors align-top">
                          <TutorCell row={row} />
                          <td className="px-4 py-3.5">
                            <StatusBadge cell={row.fn} />
                          </td>
                          <td className="px-4 py-3.5 font-jetbrains">
                            {row.fn.time ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} className="text-emerald-600" />
                                {row.fn.time}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge cell={row.an} />
                          </td>
                          <td className="px-4 py-3.5 font-jetbrains">
                            {row.an.time ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} className="text-emerald-600" />
                                {row.an.time}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold", KIND_STYLE[row.kind].cls)}>
                              {KIND_STYLE[row.kind].label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right print:hidden">
                            <EditButton onClick={() => openEdit(row, defaultEditSession(row))} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY MATRIX VIEW ─────────────────────────────────────── */}
      {activeTab === "monthly" && monthlyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <p className="text-xs font-medium text-muted-foreground font-dm-sans">Month &amp; Year</p>
              <p className="text-xl font-bold font-inter text-foreground mt-1">{monthlyData.monthName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{monthlyData.totalStaff} Hifz tutors</p>
            </div>
            <div className="bg-card border border-emerald-200/80 rounded-xl p-4 shadow-2xs bg-emerald-50/20">
              <p className="text-xs font-semibold text-emerald-700 font-dm-sans">Avg session attendance</p>
              <p className="text-2xl font-bold font-inter text-emerald-800 mt-1">{pctText(monthlyData.avgSessionRate)}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Present sessions ÷ (present + absent)</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <p className="text-xs font-medium text-muted-foreground font-dm-sans">Avg full-day attendance</p>
              <p className="text-2xl font-bold font-inter text-foreground mt-1">{pctText(monthlyData.avgFullDayRate)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Full days ÷ days with a final result</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <p className="text-xs font-medium text-muted-foreground font-dm-sans">Legend (top = FN, bottom = AN)</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] mt-1.5 font-medium">
                <span className="text-emerald-700">P Present</span>
                <span className="text-red-600">A Absent</span>
                <span className="text-amber-600">L Leave</span>
                <span className="text-slate-500">O Off day</span>
                <span className="text-sky-600">· Pending</span>
                <span className="text-orange-600">? Awaiting auto-absence</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave and off days are excluded from percentages.</p>
            </div>
          </div>

          {monthlyData.hasLegacyDays && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 font-dm-sans">
              Days before {monthlyData.sessionStartDate ?? "the FN/AN start date"} show the original single check-in
              mark (shown in italics) and are counted separately in the Legacy column, not in the FN/AN totals.
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground font-inter">
                Monthly Hifz Tutor Attendance Matrix: {monthlyData.monthName}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-jetbrains text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold font-dm-sans min-w-[140px] sticky left-0 bg-muted/90 backdrop-blur-xs z-10">
                      Tutor
                    </th>
                    {monthlyData.days.map((d) => (
                      <th
                        key={d}
                        className={cn(
                          "w-8 px-1 py-2 font-medium border-l border-border/50",
                          monthlyData.todayDate === `${monthlyData.year}-${String(monthlyData.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                            ? "bg-teal/15 text-teal-900 font-bold"
                            : ""
                        )}
                      >
                        {d}
                      </th>
                    ))}
                    <Th cls="text-emerald-700 border-l border-border">FN P</Th>
                    <Th cls="text-red-600">FN A</Th>
                    <Th cls="text-emerald-700">AN P</Th>
                    <Th cls="text-red-600">AN A</Th>
                    <Th cls="text-emerald-700 border-l border-border">Full</Th>
                    <Th cls="text-amber-600">Half</Th>
                    <Th cls="text-red-600">F.Abs</Th>
                    <Th cls="text-amber-600">Leave</Th>
                    <Th cls="text-foreground border-l border-border">Sess %</Th>
                    <Th cls="text-foreground">Day %</Th>
                    {monthlyData.hasLegacyDays && <Th cls="text-muted-foreground border-l border-border">Legacy P/A/L</Th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthlyData.staffMatrix.length === 0 ? (
                    <EmptyRow cols={monthlyData.days.length + 12} />
                  ) : (
                    monthlyData.staffMatrix.map((row) => (
                      <tr key={row.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-left sticky left-0 bg-card z-10 border-r border-border/50">
                          <p className="font-semibold text-foreground text-xs font-inter truncate max-w-[130px]">
                            {row.username}
                          </p>
                        </td>
                        {row.daysData.map((d) =>
                          d.isLegacy ? (
                            <td
                              key={d.day}
                              className={cn(
                                "p-1 border-l border-border/40 text-[11px] font-jetbrains italic select-none",
                                d.legacyStatus === "present"
                                  ? "text-emerald-700 bg-emerald-500/10"
                                  : d.legacyStatus === "leave"
                                  ? "text-amber-700 bg-amber-500/10"
                                  : d.legacyStatus === "absent"
                                  ? "text-red-600 bg-red-500/5"
                                  : "text-muted-foreground/40"
                              )}
                              title={`Legacy single check-in: ${d.legacyStatus}`}
                            >
                              {d.legacyStatus === "present" ? "P" : d.legacyStatus === "leave" ? "L" : d.legacyStatus === "absent" ? "A" : "—"}
                            </td>
                          ) : (
                            <td
                              key={d.day}
                              className="p-0 border-l border-border/40 text-[10px] font-jetbrains select-none"
                              title={`${d.date}: FN ${d.fn}, AN ${d.an}${d.offLabel ? ` (${d.offLabel})` : ""}`}
                            >
                              <div className={cn("py-0.5", MATRIX_CLS[d.fn!])}>{MATRIX_LETTER[d.fn!]}</div>
                              <div className={cn("py-0.5 border-t border-border/30", MATRIX_CLS[d.an!])}>
                                {MATRIX_LETTER[d.an!]}
                              </div>
                            </td>
                          )
                        )}
                        <Td cls="text-emerald-700 border-l border-border">{row.tally.fnPresent}</Td>
                        <Td cls="text-red-600">{row.tally.fnAbsent}</Td>
                        <Td cls="text-emerald-700">{row.tally.anPresent}</Td>
                        <Td cls="text-red-600">{row.tally.anAbsent}</Td>
                        <Td cls="text-emerald-700 border-l border-border">{row.tally.fullDays}</Td>
                        <Td cls="text-amber-600">{row.tally.halfDays}</Td>
                        <Td cls="text-red-600">{row.tally.fullDaysAbsent + row.tally.absentDays}</Td>
                        <Td cls="text-amber-600">{row.tally.leaveDays}</Td>
                        <td className="px-2 py-2 border-l border-border">
                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-jetbrains font-bold", rateCls(row.sessionRate))}>
                            {pctText(row.sessionRate)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-jetbrains font-bold", rateCls(row.fullDayRate))}>
                            {pctText(row.fullDayRate)}
                          </span>
                        </td>
                        {monthlyData.hasLegacyDays && (
                          <td className="px-2 py-2 border-l border-border font-jetbrains text-muted-foreground whitespace-nowrap">
                            {row.legacyPresent}/{row.legacyAbsent}/{row.legacyLeave}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT / CORRECT MODAL ─────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-inter text-base font-semibold text-foreground">
                  {editing.session ? "Correct Staff Attendance" : "Update Staff Attendance"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-dm-sans">
                  {editing.row.username}
                  {dailyData ? ` · ${dailyData.selectedDate}` : ""}
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-md">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {editing.session && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">Session</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["FN", "AN"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => switchSession(s)}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                          editing.session === s
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                        )}
                      >
                        {s === "FN" ? "FN: Forenoon" : "AN: Afternoon"}
                      </button>
                    ))}
                  </div>
                  {editingCell && (editingCell.source === "auto" || editingCell.corrected) && (
                    <p className="text-[11px] text-indigo-700 mt-1.5 font-dm-sans">
                      {editingCell.corrected
                        ? `Previously corrected (original: ${editingCell.originalStatus}${editingCell.originalSource === "auto" ? ", automatic" : ""}).`
                        : "This is an automatically recorded absence. Saving records a manual correction; the original is kept."}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">Attendance Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["present", "✓ Present", "border-emerald-600 bg-emerald-600"],
                      ["absent", "✗ Absent", "border-red-600 bg-red-600"],
                      ["leave", "⚠ Leave", "border-amber-600 bg-amber-600"],
                    ] as const
                  ).map(([val, text, on]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditStatus(val)}
                      className={cn(
                        "py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                        editStatus === val ? `${on} text-white shadow-xs` : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                      )}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {editStatus === "leave" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">Leave Type</label>
                  <select
                    value={editLeaveType}
                    onChange={(e) => setEditLeaveType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal"
                  >
                    <option value="casual_leave">Casual Leave</option>
                    <option value="sick_leave">Sick Leave</option>
                    <option value="approved_leave">Approved Official Leave</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">Remarks / Reason (Optional)</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Was in class, check-in missed"
                  rows={2}
                  maxLength={255}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small presentational pieces ─────────────────────────────────────────────

/** Open the correction dialog on the session that most likely needs attention. */
function defaultEditSession(row: DailyStaffRow): StaffSession {
  const needsFix = (s: CellStatus) => s === "absent" || s === "unmarked";
  if (needsFix(row.fn.status)) return "FN";
  if (needsFix(row.an.status)) return "AN";
  return "FN";
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" | "warn" }) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-200/80 bg-emerald-50/20 text-emerald-800"
      : tone === "bad"
      ? "border-border text-red-600"
      : tone === "warn"
      ? "border-amber-200/80 bg-amber-50/20 text-amber-700"
      : "border-border text-foreground";
  return (
    <div className={cn("bg-card border rounded-xl p-4 shadow-2xs", toneCls)}>
      <p className="text-xs font-medium font-dm-sans text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold font-inter mt-1">{value}</p>
    </div>
  );
}

function TutorCell({ row }: { row: DailyStaffRow }) {
  return (
    <td className="px-5 py-3.5">
      <p className="font-semibold text-foreground text-sm font-inter">{row.username}</p>
      {row.email && <p className="text-[11px] text-muted-foreground font-jetbrains">{row.email}</p>}
    </td>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-xs text-foreground font-medium transition-colors cursor-pointer"
      title="Correct attendance"
    >
      <Edit2 size={11} />
      <span>Edit</span>
    </button>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-12 text-center text-muted-foreground font-dm-sans">
        No eligible Hifz tutors found (active tutors assigned to an active Hifz class).
      </td>
    </tr>
  );
}

function Th({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return <th className={cn("px-2 py-2.5 font-semibold bg-muted/60 whitespace-nowrap", cls)}>{children}</th>;
}

function Td({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return <td className={cn("px-2 py-2 font-jetbrains font-bold", cls)}>{children}</td>;
}
