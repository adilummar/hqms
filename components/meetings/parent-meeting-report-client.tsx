"use client";

import { useState, useMemo } from "react";
import { Printer, Search, ArrowUpDown, ChevronDown, Users, UserCheck, UserX, ClipboardList } from "lucide-react";

export interface MeetingReportRow {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  className: string;
  classTrack: string;
  attended: boolean;
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
type StatusFilter = "all" | "attended" | "absent";

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
    if (statusFilter === "attended") data = data.filter((r) => r.attended);
    else if (statusFilter === "absent") data = data.filter((r) => !r.attended);

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
        cmp = Number(b.attended) - Number(a.attended); // attended first by default
      } else if (sortField === "remarks") {
        cmp = (a.remarks ?? "").localeCompare(b.remarks ?? "");
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [rows, statusFilter, search, sortField, sortAsc]);

  const attendedCount = rows.filter((r) => r.attended).length;
  const absentCount = rows.filter((r) => !r.attended).length;
  const attendanceRate = rows.length > 0 ? Math.round((attendedCount / rows.length) * 100) : 0;

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        {[
          {
            icon: <Users size={18} />,
            label: "Total Students",
            value: rows.length,
            color: "text-foreground",
            bg: "bg-card border-border",
          },
          {
            icon: <UserCheck size={18} />,
            label: "Parents Attended",
            value: attendedCount,
            color: "text-emerald-700",
            bg: "bg-emerald-50 border-emerald-200",
          },
          {
            icon: <UserX size={18} />,
            label: "Parents Absent",
            value: absentCount,
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
            <option value="attended">Parents Attended</option>
            <option value="absent">Parents Absent</option>
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
        {statusFilter !== "all" && ` · Filtered: ${statusFilter === "attended" ? "Attended" : "Absent"}`}
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
            <span><strong>Attended:</strong> {attendedCount}</span>
            <span><strong>Absent:</strong> {absentCount}</span>
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
                filtered.map((row, idx) => (
                  <tr
                    key={row.studentId}
                    className={`transition-colors print:break-inside-avoid ${
                      row.attended
                        ? "hover:bg-emerald-50/30 print:bg-white"
                        : "bg-red-50/20 hover:bg-red-50/40 print:bg-white"
                    }`}
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
                      {row.attended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 print:bg-transparent print:text-gray-800 print:border print:border-gray-400">
                          <span className="print:hidden">✓</span> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 print:bg-transparent print:text-gray-800 print:border print:border-gray-400">
                          <span className="print:hidden">✗</span> No
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground print:text-gray-600 italic">
                      {row.remarks ? row.remarks : <span className="text-muted-foreground/40 not-italic">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table footer with totals */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border print:border-gray-700 bg-muted/30 print:bg-transparent">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-muted-foreground print:text-gray-700">
                    Total: {filtered.length} {statusFilter !== "all" ? `(filtered from ${rows.length})` : "students"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-xs font-semibold text-emerald-700 print:text-gray-800">
                      {filtered.filter((r) => r.attended).length} attended
                    </span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="text-xs font-semibold text-red-600 print:text-gray-800">
                      {filtered.filter((r) => !r.attended).length} absent
                    </span>
                  </td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Print-only signature block ─────────────────────────── */}
      <div className="hidden print:block mt-10 pt-6 border-t border-gray-300">
        <div className="grid grid-cols-3 gap-8 text-sm">
          {["Prepared By", "Verified By", "Principal"].map((role) => (
            <div key={role} className="text-center">
              <div className="h-10 border-b border-gray-400 mb-1" />
              <p className="text-xs text-gray-500">{role}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 text-right mt-4">
          Printed on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}Generated by HQMS
        </p>
      </div>
    </div>
  );
}
