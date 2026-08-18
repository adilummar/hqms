"use client";

import { useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

export type YearlyMeetingReportRow = {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  className: string;
  classTrack: string;
  totalAttended: number;
  totalMeetings: number;
  attendanceDetails: {
    meetingId: string;
    meetingTitle: string;
    attended: boolean;
    remarks: string | null;
  }[];
};

interface Props {
  rows: YearlyMeetingReportRow[];
  totalMeetings: number;
  yearLabel: string;
}

export function YearlyParentMeetingReportClient({ rows, totalMeetings, yearLabel }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "class" | "attendance">("class");
  const [sortDesc, setSortDesc] = useState(false);

  const filtered = rows.filter((r) => {
    const search = searchTerm.toLowerCase();
    const fullName = `${r.firstName} ${r.lastName || ""}`.toLowerCase();
    return fullName.includes(search) || r.studentCode.toLowerCase().includes(search);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "name") {
      const cmp = a.firstName.localeCompare(b.firstName);
      return sortDesc ? -cmp : cmp;
    }
    if (sortField === "class") {
      const cmp = a.className.localeCompare(b.className);
      if (cmp !== 0) return sortDesc ? -cmp : cmp;
      return a.firstName.localeCompare(b.firstName);
    }
    if (sortField === "attendance") {
      const cmp = a.totalAttended - b.totalAttended;
      return sortDesc ? -cmp : cmp;
    }
    return 0;
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border flex flex-wrap gap-4 justify-between items-center bg-muted/20 print:hidden">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:border-foreground/30 transition-colors"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 font-semibold text-muted-foreground w-12">#</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">
                <button
                  onClick={() => { setSortField("name"); setSortDesc(sortField === "name" ? !sortDesc : false); }}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  Student
                  <ArrowUpDown size={12} className={sortField === "name" ? "text-foreground" : "opacity-30"} />
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">
                <button
                  onClick={() => { setSortField("class"); setSortDesc(sortField === "class" ? !sortDesc : false); }}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  Class
                  <ArrowUpDown size={12} className={sortField === "class" ? "text-foreground" : "opacity-30"} />
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">
                <button
                  onClick={() => { setSortField("attendance"); setSortDesc(sortField === "attendance" ? !sortDesc : false); }}
                  className="flex items-center justify-center gap-1.5 hover:text-foreground transition-colors w-full"
                >
                  Attended
                  <ArrowUpDown size={12} className={sortField === "attendance" ? "text-foreground" : "opacity-30"} />
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-muted-foreground min-w-[200px]">
                Meeting Breakdown ({yearLabel})
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row, idx) => (
              <tr key={row.studentId} className="hover:bg-muted/10 transition-colors group">
                <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground font-jetbrains mt-0.5">
                    {row.studentCode}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{row.className}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize bg-muted text-muted-foreground mt-1 inline-block">
                    {row.classTrack}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center justify-center bg-muted/40 px-3 py-1 rounded-full border border-border">
                    <span className="font-semibold text-foreground mr-1">{row.totalAttended}</span>
                    <span className="text-muted-foreground text-xs">/ {totalMeetings}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {row.attendanceDetails.map((det) => (
                      <div
                        key={det.meetingId}
                        title={det.remarks ?? undefined}
                        className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${
                          det.attended
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        <span className="max-w-[120px] truncate">{det.meetingTitle}</span>
                        <span>{det.attended ? "✅" : "❌"}</span>
                      </div>
                    ))}
                    {row.attendanceDetails.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No meetings scheduled/recorded</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No students found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
