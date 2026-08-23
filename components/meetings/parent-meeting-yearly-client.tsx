"use client";

import { useState, useMemo } from "react";
import { Printer, Search, ArrowUpDown, ChevronDown, Users, CheckCircle2, XCircle } from "lucide-react";

export interface YearlyMeetingInfo {
  id: string;
  title: string;
  meetingDate: string;
}

export interface YearlyStudentRow {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  className: string;
  classTrack: string;
  attendance: Record<string, boolean | null>;
}

interface Props {
  meetings: YearlyMeetingInfo[];
  rows: YearlyStudentRow[];
  selectedClassId: string | null;
  academicYearLabel?: string;
  schoolName?: string;
}

type SortField = "name" | "class" | "rate";
type StatusFilter = "all" | "perfect" | "poor";

export function ParentMeetingYearlyReportClient({
  meetings,
  rows,
  selectedClassId,
  academicYearLabel = "Current Year",
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

  const getAttendanceRate = (attendance: Record<string, boolean | null>) => {
    let attended = 0;
    let total = 0;
    for (const m of meetings) {
      if (attendance[m.id] !== null && attendance[m.id] !== undefined) {
        total++;
        if (attendance[m.id] === true) attended++;
      }
    }
    return total > 0 ? Math.round((attended / total) * 100) : 0;
  };

  const filtered = useMemo(() => {
    let data = [...rows];

    // Status filter
    if (statusFilter === "perfect") {
      data = data.filter((r) => getAttendanceRate(r.attendance) === 100);
    } else if (statusFilter === "poor") {
      data = data.filter((r) => getAttendanceRate(r.attendance) < 50);
    }

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
      } else if (sortField === "rate") {
        cmp = getAttendanceRate(b.attendance) - getAttendanceRate(a.attendance); // higher first
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [rows, statusFilter, search, sortField, sortAsc, meetings]);

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
            <option value="perfect">Perfect Attendance (100%)</option>
            <option value="poor">Poor Attendance (&lt;50%)</option>
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
        {statusFilter !== "all" && ` · Filtered`}
        {search && ` · Search: "${search}"`}
      </p>

      {/* ── Report Table ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm print:shadow-none print:border-none overflow-hidden">
        {/* Print-only header inside table card */}
        <div className="hidden print:block px-6 pt-6 pb-4 border-b border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{schoolName}</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">Yearly Parent Meeting Report</h2>
          <div className="flex flex-wrap gap-6 mt-2 text-sm text-gray-600">
            <span><strong>Academic Year:</strong> {academicYearLabel}</span>
            <span><strong>Total Students:</strong> {rows.length}</span>
            <span><strong>Total Meetings:</strong> {meetings.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border print:bg-transparent print:border-b-2 print:border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold w-10 sticky left-0 z-10 bg-muted/50 print:bg-transparent">
                  #
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold sticky left-10 z-10 bg-muted/50 print:bg-transparent min-w-[200px]">
                  <SortBtn field="name" label="Student" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold sticky left-[250px] z-10 bg-muted/50 print:bg-transparent shadow-[4px_0_12px_rgba(0,0,0,0.05)] print:shadow-none min-w-[120px]">
                  <SortBtn field="class" label="Class" />
                </th>
                {meetings.map((m) => (
                  <th key={m.id} className="text-center px-4 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold min-w-[100px]">
                    <div className="flex flex-col items-center">
                      <span className="truncate max-w-[120px]">{m.title}</span>
                      <span className="text-[10px] mt-0.5 opacity-70">
                        {new Date(m.meetingDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground print:text-gray-700 print:font-semibold min-w-[100px]">
                  <SortBtn field="rate" label="Att. Rate" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4 + meetings.length} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const rate = getAttendanceRate(row.attendance);
                  return (
                    <tr
                      key={row.studentId}
                      className="transition-colors hover:bg-muted/30 print:bg-white print:break-inside-avoid group"
                    >
                      <td className="px-5 py-3 text-xs text-muted-foreground font-jetbrains print:text-gray-500 sticky left-0 z-10 bg-card group-hover:bg-muted/30 print:bg-transparent">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3 sticky left-10 z-10 bg-card group-hover:bg-muted/30 print:bg-transparent">
                        <div className="font-medium text-foreground print:text-gray-900 truncate max-w-[200px]">
                          {row.firstName} {row.lastName ?? ""}
                        </div>
                        <div className="text-xs text-muted-foreground font-jetbrains print:text-gray-500">
                          {row.studentCode}
                        </div>
                      </td>
                      <td className="px-5 py-3 sticky left-[250px] z-10 bg-card group-hover:bg-muted/30 print:bg-transparent shadow-[4px_0_12px_rgba(0,0,0,0.05)] print:shadow-none">
                        <span className="text-muted-foreground print:text-gray-600 truncate block max-w-[120px]">{row.className}</span>
                      </td>
                      {meetings.map((m) => {
                        const att = row.attendance[m.id];
                        return (
                          <td key={m.id} className="px-4 py-3 text-center">
                            {att === true ? (
                              <div className="mx-auto flex justify-center text-emerald-600">
                                <CheckCircle2 size={16} />
                              </div>
                            ) : att === false ? (
                              <div className="mx-auto flex justify-center text-red-500">
                                <XCircle size={16} />
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold ${
                            rate >= 80
                              ? "bg-emerald-100 text-emerald-700 print:border-emerald-600 print:border"
                              : rate >= 50
                              ? "bg-amber-100 text-amber-700 print:border-amber-600 print:border"
                              : "bg-red-100 text-red-600 print:border-red-600 print:border"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
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
