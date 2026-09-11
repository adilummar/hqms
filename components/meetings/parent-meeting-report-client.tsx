"use client";

import { useState, useMemo } from "react";
import { Printer, Search, ArrowUpDown, ChevronDown, Users, UserCheck, UserX, ClipboardList, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

export interface MeetingReportRow {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  className: string;
  classTrack: string;
  attended: boolean | null;
  status: string | null;
  remarks: string | null;
}

export interface MeetingInfo {
  id: string;
  title: string;
  meetingDate: string;
  description: string | null;
}

interface Props {
  meeting: MeetingInfo;
  rows: MeetingReportRow[];
  allClasses: { id: string; name: string; track: string }[];
  selectedClassId: string | null;
  formattedDate: string;
  schoolName?: string;
}

type SortField = "name" | "class" | "status" | "remarks";
type StatusFilter = "all" | "on_time" | "late" | "absent_reason" | "absent_no_reason" | "legacy_attended" | "legacy_absent";

export function ParentMeetingReportClient({
  meeting,
  rows,
  allClasses,
  selectedClassId,
  formattedDate,
  schoolName = "HQMS",
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((p) => !p);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    let data = [...rows];

    // Status filter
    if (statusFilter === "on_time") data = data.filter((r) => r.status === "ON_TIME");
    else if (statusFilter === "late") data = data.filter((r) => r.status === "LATE");
    else if (statusFilter === "absent_reason") data = data.filter((r) => r.status === "ABSENT_WITH_REASON");
    else if (statusFilter === "absent_no_reason") data = data.filter((r) => r.status === "ABSENT_WITHOUT_VALID_REASON");
    else if (statusFilter === "legacy_attended") data = data.filter((r) => r.status === null && r.attended === true);
    else if (statusFilter === "legacy_absent") data = data.filter((r) => r.status === null && r.attended === false);

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter(
        (r) =>
          r.firstName.toLowerCase().includes(q) ||
          (r.lastName ?? "").toLowerCase().includes(q) ||
          r.studentCode.toLowerCase().includes(q) ||
          r.className.toLowerCase().includes(q)
      );
    }

    // Sort
    data.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.firstName.localeCompare(b.firstName);
      } else if (sortField === "class") {
        cmp = a.className.localeCompare(b.className);
      } else if (sortField === "status") {
        cmp = (a.status || String(a.attended)).localeCompare(b.status || String(b.attended));
      } else if (sortField === "remarks") {
        cmp = (a.remarks ?? "").localeCompare(b.remarks ?? "");
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [rows, statusFilter, search, sortField, sortAsc]);

  const onTimeCount = rows.filter((r) => r.status === "ON_TIME").length;
  const lateCount = rows.filter((r) => r.status === "LATE").length;
  const absentReasonCount = rows.filter((r) => r.status === "ABSENT_WITH_REASON").length;
  const absentNoReasonCount = rows.filter((r) => r.status === "ABSENT_WITHOUT_VALID_REASON").length;
  const legacyAttendedCount = rows.filter((r) => r.status === null && r.attended === true).length;
  const legacyAbsentCount = rows.filter((r) => r.status === null && r.attended === false).length;

  const totalAttended = onTimeCount + lateCount + legacyAttendedCount;
  const totalAbsent = absentReasonCount + absentNoReasonCount + legacyAbsentCount;
  const recordedRows = rows.filter(r => r.status !== null || r.attended !== null).length;
  const attendanceRate = recordedRows > 0 ? Math.round((totalAttended / recordedRows) * 100) : 0;

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors group"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown
        size={13}
        className={`transition-opacity ${sortField === field ? "opacity-100 text-foreground" : "opacity-40 group-hover:opacity-70"}`}
      />
    </button>
  );

  return (
    <div className="space-y-5">
      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
        {[
          {
            icon: <Users size={18} />,
            label: "Total Students",
            value: rows.length,
            color: "text-foreground",
            bg: "bg-card border-border",
          },
          {
            icon: <CheckCircle2 size={18} />,
            label: "On Time (inc. Legacy)",
            value: totalAttended,
            color: "text-emerald-700",
            bg: "bg-emerald-50 border-emerald-200",
          },
          {
            icon: <Clock size={18} />,
            label: "Late",
            value: lateCount,
            color: "text-blue-700",
            bg: "bg-blue-50 border-blue-200",
          },
          {
            icon: <AlertCircle size={18} />,
            label: "Absent",
            value: totalAbsent,
            color: "text-red-600",
            bg: "bg-red-50 border-red-200",
          },
          {
            icon: <ClipboardList size={18} />,
            label: "Attendance Rate",
            value: `${attendanceRate}%`,
            color: attendanceRate >= 80 ? "text-emerald-700" : attendanceRate >= 50 ? "text-amber-600" : "text-red-600",
            bg: "bg-card border-border",
          },
        ].map(({ icon, label, value, color, bg }) => (
          <div key={label} className={`rounded-lg border px-4 py-3 ${bg}`}>
            <div className={`${color} mb-1 opacity-70`}>{icon}</div>
            <p className={`font-playfair text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or class…"
            className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 pl-3 pr-8 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground appearance-none"
          >
            <option value="all">All Students</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
            <option value="absent_reason">Absent (Reason)</option>
            <option value="absent_no_reason">Absent (No Reason)</option>
            <option value="legacy_attended">Legacy: Attended</option>
            <option value="legacy_absent">Legacy: Absent</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Print button */}
        <button
          onClick={() => window.print()}
          className="h-9 px-4 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 ml-auto"
        >
          <Printer size={14} />
          Print / Save PDF
        </button>
      </div>

      {/* ── Showing info ──────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground print:hidden">
        Showing {filtered.length} of {rows.length} students
        {statusFilter !== "all" && ` · Filtered by Status`}
        {search && ` · Search: "${search}"`}
      </p>

      {/* ── Report Table ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm print:shadow-none print:border-none overflow-hidden">
        {/* Print-only header inside table card */}
        <div className="hidden print:block px-6 pt-6 pb-4 border-b border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{schoolName}</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">Parent Meeting Attendance Report</h2>
          <div className="flex flex-wrap gap-6 mt-2 text-sm text-gray-600">
            <span><strong>Meeting:</strong> {meeting.title}</span>
            <span><strong>Date:</strong> {formattedDate}</span>
            <span><strong>Total:</strong> {rows.length} students</span>
            <span><strong>Attended (On Time/Legacy):</strong> {totalAttended}</span>
            <span><strong>Late:</strong> {lateCount}</span>
            <span><strong>Absent:</strong> {totalAbsent}</span>
            <span><strong>Rate:</strong> {attendanceRate}%</span>
          </div>
          {meeting.description && (
            <p className="text-xs text-gray-500 mt-2 italic">{meeting.description}</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border print:bg-transparent print:border-b-2 print:border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold w-10">
                  #
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold">
                  <SortBtn field="name" label="Student" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold">
                  <SortBtn field="class" label="Class" />
                </th>
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold">
                  <SortBtn field="status" label="Parent Attended?" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold">
                  <SortBtn field="remarks" label="Remarks" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    {rows.length === 0
                      ? "No attendance data recorded for this meeting."
                      : "No students match the current filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  let uiLabel = "Not Marked";
                  let uiColor = "bg-gray-100 text-gray-800";
                  if (row.status === "ON_TIME") {
                    uiLabel = "On Time"; uiColor = "bg-emerald-100 text-emerald-800";
                  } else if (row.status === "LATE") {
                    uiLabel = "Late"; uiColor = "bg-blue-100 text-blue-800";
                  } else if (row.status === "ABSENT_WITH_REASON") {
                    uiLabel = "Absent (Reason)"; uiColor = "bg-yellow-100 text-yellow-800";
                  } else if (row.status === "ABSENT_WITHOUT_VALID_REASON") {
                    uiLabel = "Absent (No Reason)"; uiColor = "bg-red-100 text-red-800";
                  } else if (row.attended !== null) {
                    uiLabel = row.attended ? "Legacy: Attended" : "Legacy: Absent";
                    uiColor = "bg-gray-100 text-gray-800";
                  }

                  return (
                    <tr
                      key={row.studentId}
                      className={`transition-colors print:break-inside-avoid hover:bg-muted/30`}
                    >
                      <td className="px-5 py-3 text-xs text-muted-foreground font-jetbrains print:text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground print:text-gray-900">
                          {row.firstName} {row.lastName ?? ""}
                        </div>
                        <div className="text-xs text-muted-foreground font-jetbrains print:text-gray-500">
                          {row.studentCode}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-muted-foreground print:text-gray-600">{row.className}</span>
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize print:hidden">
                          {row.classTrack}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${uiColor} print:bg-transparent print:text-gray-800 print:border print:border-gray-400`}>
                          {uiLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground print:text-gray-600 italic">
                        {row.remarks ? row.remarks : <span className="text-muted-foreground/40 not-italic">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
