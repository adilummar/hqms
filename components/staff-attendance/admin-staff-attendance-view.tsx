"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Loader2,
  Printer,
  UserCheck,
  UserX,
  Users,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
} from "lucide-react";
import { adminRecordStaffAttendance } from "@/lib/actions/staff-attendance";
import { STAFF_ROLES } from "@/lib/constants/staff";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StaffRow {
  userId: string;
  username: string;
  email: string | null;
  role: string;
  status: "present" | "absent" | "leave" | "unmarked";
  leaveType: string | null;
  remarks: string | null;
  checkInTime: string | null;
  recordedBy: string | null;
  hasRecord: boolean;
}

interface DailyData {
  selectedDate: string;
  totalStaff: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  attendanceRate: number;
  staffRows: StaffRow[];
}

interface DayCell {
  day: number;
  date: string;
  status: "present" | "absent" | "leave" | "future" | "unmarked";
  checkInTime: string | null;
  remarks: string | null;
}

interface MatrixRow {
  userId: string;
  username: string;
  email: string | null;
  role: string;
  daysData: DayCell[];
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  rate: number;
}

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  days: number[];
  totalStaff: number;
  pastDaysInMonth: number;
  avgAttendance: number;
  staffMatrix: MatrixRow[];
}

interface Props {
  viewMode: "daily" | "monthly";
  dailyData?: DailyData;
  monthlyData?: MonthlyData;
  roleFilter?: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  tutor: "Tutor",
  school_admin: "School Admin",
  madrasa_admin: "Madrasa Admin",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-50 text-purple-700 border-purple-200",
  admin: "bg-teal-50 text-teal-700 border-teal-200",
  tutor: "bg-blue-50 text-blue-700 border-blue-200",
  school_admin: "bg-orange-50 text-orange-700 border-orange-200",
  madrasa_admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export function AdminStaffAttendanceView({
  viewMode: initialViewMode,
  dailyData,
  monthlyData,
  roleFilter: initialRoleFilter = "all",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"daily" | "monthly">(initialViewMode);
  const [selectedRole, setSelectedRole] = useState<string>(initialRoleFilter);

  // Edit modal state
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [editStatus, setEditStatus] = useState<"present" | "absent" | "leave">("present");
  const [editLeaveType, setEditLeaveType] = useState<string>("casual_leave");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Helper to push query updates
  function updateQuery(params: Record<string, string | number | undefined>) {
    const current = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        current.set(key, String(value));
      } else {
        current.delete(key);
      }
    }
    router.push(`/admin/attendance/staff?${current.toString()}`);
  }

  function handleTabChange(tab: "daily" | "monthly") {
    setActiveTab(tab);
    updateQuery({ view: tab });
  }

  function handleRoleChange(role: string) {
    setSelectedRole(role);
    updateQuery({ role });
  }

  function handleDateChange(dateStr: string) {
    updateQuery({ date: dateStr, view: "daily" });
  }

  function handleMonthChange(month: number) {
    updateQuery({ month, view: "monthly" });
  }

  function handleYearChange(year: number) {
    updateQuery({ year, view: "monthly" });
  }

  // Quick date offsets
  function stepDate(days: number) {
    const currentDate = new Date(dailyData?.selectedDate ?? new Date());
    currentDate.setDate(currentDate.getDate() + days);
    const newDateStr = currentDate.toISOString().split("T")[0];
    handleDateChange(newDateStr);
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

  function openEditModal(staff: StaffRow) {
    setEditingStaff(staff);
    setEditStatus(staff.status === "unmarked" ? "present" : staff.status);
    setEditLeaveType(staff.leaveType || "casual_leave");
    setEditRemarks(staff.remarks || "");
  }

  function handleSaveAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStaff || !dailyData) return;

    startTransition(async () => {
      const result = await adminRecordStaffAttendance({
        userId: editingStaff.userId,
        date: dailyData.selectedDate,
        status: editStatus,
        leaveType: editStatus === "leave" ? editLeaveType : null,
        remarks: editRemarks.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Updated attendance for ${editingStaff.username}`);
        setEditingStaff(null);
        router.refresh();
      } else {
        toast.error("Failed to update attendance");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Top Controls Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-2xs print:hidden">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg">
          <button
            onClick={() => handleTabChange("daily")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer font-dm-sans",
              activeTab === "daily"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calendar size={14} />
            <span>Daily Report</span>
          </button>
          <button
            onClick={() => handleTabChange("monthly")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer font-dm-sans",
              activeTab === "monthly"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays size={14} />
            <span>Monthly Matrix</span>
          </button>
        </div>

        {/* Date / Month Selectors & Role Filter */}
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
                onClick={() => handleDateChange(new Date().toISOString().split("T")[0])}
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
                onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2025, m - 1, 1).toLocaleDateString("en-IN", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={monthlyData.year}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-jetbrains"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
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

          {/* Role Filter Dropdown */}
          <div className="flex items-center gap-1.5 pl-1">
            <Filter size={13} className="text-muted-foreground shrink-0" />
            <select
              value={selectedRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans"
            >
              <option value="all">All Roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </div>

          {/* Print button */}
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

      {/* ── DAILY VIEW ──────────────────────────────────────────────── */}
      {activeTab === "daily" && dailyData && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-medium font-dm-sans">Total Staff</span>
                <Users size={16} className="text-slate-400" />
              </div>
              <p className="text-2xl font-bold font-inter text-foreground">
                {dailyData.totalStaff}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active staff accounts</p>
            </div>

            <div className="bg-card border border-emerald-200/80 rounded-xl p-4 shadow-2xs bg-emerald-50/20">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-semibold font-dm-sans">Checked In (Present)</span>
                <UserCheck size={16} className="text-emerald-600" />
              </div>
              <p className="text-2xl font-bold font-inter text-emerald-800">
                {dailyData.presentCount}
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                {dailyData.attendanceRate}% Attendance Rate
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-medium font-dm-sans">Not Checked In / Absent</span>
                <UserX size={16} className="text-red-500" />
              </div>
              <p className="text-2xl font-bold font-inter text-red-600">
                {dailyData.absentCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {dailyData.totalStaff > 0
                  ? Math.round((dailyData.absentCount / dailyData.totalStaff) * 100)
                  : 0}
                % of total staff
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-xs font-medium font-dm-sans">On Leave</span>
                <AlertCircle size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-bold font-inter text-amber-600">
                {dailyData.leaveCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Approved or casual leave</p>
            </div>
          </div>

          {/* Daily Table Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground font-inter">
                  Staff Daily Check-In Logs
                </h3>
                <p className="text-xs text-muted-foreground font-dm-sans">
                  Attendance records for{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(dailyData.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-dm-sans">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Staff Member</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Attendance Status</th>
                    <th className="px-4 py-3 font-semibold">Check-In Time</th>
                    <th className="px-4 py-3 font-semibold">Remarks / Log</th>
                    <th className="px-4 py-3 font-semibold text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dailyData.staffRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                        No staff members found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    dailyData.staffRows.map((staff) => (
                      <tr key={staff.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-foreground text-sm font-inter">
                            {staff.username}
                          </p>
                          {staff.email && (
                            <p className="text-[11px] text-muted-foreground font-jetbrains">
                              {staff.email}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border font-dm-sans",
                              ROLE_COLORS[staff.role] ?? "bg-slate-100 text-slate-700"
                            )}
                          >
                            {ROLE_LABELS[staff.role] ?? staff.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {staff.status === "present" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              Present
                            </span>
                          ) : staff.status === "leave" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                              <AlertCircle size={12} className="text-amber-600" />
                              Leave {staff.leaveType ? `(${staff.leaveType.replace("_", " ")})` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">
                              <UserX size={12} className="text-red-500" />
                              {staff.hasRecord ? "Absent" : "Not Checked In"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {staff.checkInTime ? (
                            <div className="flex items-center gap-1.5 text-foreground font-jetbrains font-medium">
                              <Clock size={12} className="text-emerald-600" />
                              <span>{staff.checkInTime}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {staff.remarks ? (
                            <p className="max-w-xs truncate text-[11px]">{staff.remarks}</p>
                          ) : (
                            <span>—</span>
                          )}
                          {staff.recordedBy && (
                            <p className="text-[10px] text-muted-foreground/70">
                              By: {staff.recordedBy}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right print:hidden">
                          <button
                            onClick={() => openEditModal(staff)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-xs text-foreground font-medium transition-colors cursor-pointer"
                            title="Override or update attendance"
                          >
                            <Edit2 size={11} />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY MATRIX VIEW ─────────────────────────────────────── */}
      {activeTab === "monthly" && monthlyData && (
        <div className="space-y-6">
          {/* Monthly KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <p className="text-xs font-medium text-muted-foreground font-dm-sans">
                Month & Year
              </p>
              <p className="text-xl font-bold font-inter text-foreground mt-1">
                {monthlyData.monthName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {monthlyData.days.length} Total Days in Month
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <p className="text-xs font-medium text-muted-foreground font-dm-sans">
                Total Staff Tracked
              </p>
              <p className="text-2xl font-bold font-inter text-foreground mt-1">
                {monthlyData.totalStaff}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across assigned roles</p>
            </div>

            <div className="bg-card border border-emerald-200/80 rounded-xl p-4 shadow-2xs bg-emerald-50/20">
              <p className="text-xs font-semibold text-emerald-700 font-dm-sans">
                Average Staff Attendance
              </p>
              <p className="text-2xl font-bold font-inter text-emerald-800 mt-1">
                {monthlyData.avgAttendance}%
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                Based on {monthlyData.pastDaysInMonth} elapsed days
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-2xs">
              <p className="text-xs font-medium text-muted-foreground font-dm-sans">
                Legend
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] mt-1.5 font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> P = Present
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> A = Absent
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> L = Leave
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Grid Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground font-inter">
                Monthly Staff Attendance Matrix — {monthlyData.monthName}
              </h3>
              <p className="text-xs text-muted-foreground font-dm-sans">
                Comprehensive day-by-day record of staff presence and check-ins.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-jetbrains text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold font-dm-sans min-w-[140px] sticky left-0 bg-muted/90 backdrop-blur-xs z-10">
                      Staff Member
                    </th>
                    <th className="px-2 py-2.5 text-left font-semibold font-dm-sans min-w-[90px]">
                      Role
                    </th>
                    {monthlyData.days.map((d) => (
                      <th
                        key={d}
                        className={cn(
                          "w-8 px-1 py-2 font-medium border-l border-border/50",
                          d === new Date().getDate() &&
                            monthlyData.month === new Date().getMonth() + 1 &&
                            monthlyData.year === new Date().getFullYear()
                            ? "bg-teal/15 text-teal-900 font-bold"
                            : ""
                        )}
                      >
                        {d}
                      </th>
                    ))}
                    <th className="px-2 py-2.5 font-semibold text-emerald-700 border-l border-border bg-muted/60">
                      P
                    </th>
                    <th className="px-2 py-2.5 font-semibold text-red-600 bg-muted/60">
                      A
                    </th>
                    <th className="px-2 py-2.5 font-semibold text-amber-600 bg-muted/60">
                      L
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-foreground border-l border-border bg-muted/60">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthlyData.staffMatrix.length === 0 ? (
                    <tr>
                      <td
                        colSpan={monthlyData.days.length + 6}
                        className="px-5 py-12 text-center text-muted-foreground font-dm-sans"
                      >
                        No staff members found.
                      </td>
                    </tr>
                  ) : (
                    monthlyData.staffMatrix.map((row) => (
                      <tr key={row.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-left sticky left-0 bg-card z-10 border-r border-border/50">
                          <p className="font-semibold text-foreground text-xs font-inter truncate max-w-[130px]">
                            {row.username}
                          </p>
                        </td>
                        <td className="px-2 py-2.5 text-left">
                          <span
                            className={cn(
                              "inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold border font-dm-sans",
                              ROLE_COLORS[row.role] ?? "bg-slate-100 text-slate-700"
                            )}
                          >
                            {ROLE_LABELS[row.role]?.slice(0, 7) ?? row.role}
                          </span>
                        </td>

                        {/* 1..31 Days */}
                        {row.daysData.map((d) => (
                          <td
                            key={d.day}
                            className={cn(
                              "p-1 border-l border-border/40 text-[11px] font-jetbrains select-none",
                              d.status === "present"
                                ? "bg-emerald-500/15 text-emerald-800 font-bold"
                                : d.status === "leave"
                                ? "bg-amber-500/15 text-amber-800 font-medium"
                                : d.status === "absent"
                                ? "bg-red-500/10 text-red-700 font-medium"
                                : "text-muted-foreground/40"
                            )}
                            title={
                              d.status === "present"
                                ? `Present (Checked in at ${d.checkInTime ?? "recorded"})`
                                : d.status === "leave"
                                ? `Leave`
                                : d.status === "absent"
                                ? `Absent`
                                : "Future date"
                            }
                          >
                            {d.status === "present" ? (
                              "P"
                            ) : d.status === "leave" ? (
                              "L"
                            ) : d.status === "absent" ? (
                              "A"
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}

                        {/* Summary Numbers */}
                        <td className="px-2 py-2 font-jetbrains font-bold text-emerald-700 border-l border-border">
                          {row.presentCount}
                        </td>
                        <td className="px-2 py-2 font-jetbrains font-bold text-red-600">
                          {row.absentCount}
                        </td>
                        <td className="px-2 py-2 font-jetbrains font-bold text-amber-600">
                          {row.leaveCount}
                        </td>
                        <td className="px-3 py-2 border-l border-border">
                          <span
                            className={cn(
                              "inline-block px-1.5 py-0.5 rounded text-[10px] font-jetbrains font-bold",
                              row.rate >= 85
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : row.rate >= 70
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            )}
                          >
                            {row.rate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT ATTENDANCE MODAL ────────────────────────────────────── */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-inter text-base font-semibold text-foreground">
                  Update Staff Attendance
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-dm-sans">
                  {editingStaff.username} ({ROLE_LABELS[editingStaff.role] ?? editingStaff.role})
                </p>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus("present")}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                      editStatus === "present"
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-emerald-400"
                    )}
                  >
                    ✓ Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("absent")}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                      editStatus === "absent"
                        ? "border-red-600 bg-red-600 text-white shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-red-400"
                    )}
                  >
                    ✗ Absent
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("leave")}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                      editStatus === "leave"
                        ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-amber-400"
                    )}
                  >
                    ⚠ Leave
                  </button>
                </div>
              </div>

              {editStatus === "leave" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                    Leave Type
                  </label>
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
                <label className="block text-xs font-semibold text-foreground mb-1 font-dm-sans">
                  Remarks / Reason (Optional)
                </label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Incurred half-day delay or medical certificate submitted"
                  rows={2}
                  maxLength={255}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
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
