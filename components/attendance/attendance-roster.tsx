"use client";

import { useState, useTransition } from "react";
import { bulkMarkAttendance } from "@/lib/actions/attendance";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "leave";
type LeaveType = "sick_leave" | "casual_leave" | "approved_leave";
type Track = "hifz" | "madrasa" | "school";

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
}

interface ExistingEntry {
  studentId: string;
  status: AttendanceStatus;
  leaveType?: LeaveType | null;
  remarks?: string | null;
}

interface RemarkOption {
  id: string;
  label: string;
}

interface Props {
  students: Student[];
  classId: string;
  track: Track;
  date: string;
  existingEntries: ExistingEntry[];
  remarkOptions?: RemarkOption[];
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  leave: "L",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-foreground text-background border-foreground",
  absent: "bg-red-50 text-red-700 border-red-300",
  leave: "bg-muted text-muted-foreground border-border",
};

export function AttendanceRoster({ students, classId, track, date, existingEntries, remarkOptions = [] }: Props) {
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      const existing = existingEntries.find((e) => e.studentId === s.id);
      map[s.id] = existing?.status ?? "present";
    }
    return map;
  });
  const [remarks, setRemarks] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of students) {
      const existing = existingEntries.find((e) => e.studentId === s.id);
      map[s.id] = existing?.remarks ?? "";
    }
    return map;
  });

  const presentCount = Object.values(entries).filter((s) => s === "present").length;
  const absentCount = Object.values(entries).filter((s) => s === "absent").length;
  const leaveCount = Object.values(entries).filter((s) => s === "leave").length;

  function setAll(status: AttendanceStatus) {
    setEntries((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = status;
      return next;
    });
  }

  async function handleSave() {
    startTransition(async () => {
      const entriesArr = Object.entries(entries).map(([studentId, status]) => ({
        studentId,
        status,
        // Remarks only apply to absent students; clear otherwise.
        remarks: status === "absent" ? remarks[studentId]?.trim() || undefined : undefined,
      }));

      const result = await bulkMarkAttendance({
        classId,
        track,
        date,
        entries: entriesArr,
      });

      if (result.success) {
        toast.success(`Attendance saved — ${presentCount} present, ${absentCount} absent, ${leaveCount} leave`);
      } else {
        toast.error("Failed to save attendance");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-sm bg-foreground text-background text-xs flex items-center justify-center font-medium">P</span>
          <span className="text-muted-foreground">{presentCount} Present</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-sm bg-red-50 text-red-700 border border-red-300 text-xs flex items-center justify-center font-medium">A</span>
          <span className="text-muted-foreground">{absentCount} Absent</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-sm bg-muted text-muted-foreground border border-border text-xs flex items-center justify-center font-medium">L</span>
          <span className="text-muted-foreground">{leaveCount} Leave</span>
        </span>
        <span className="text-muted-foreground">/ {students.length} total</span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setAll("present")}
          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors"
        >
          Mark All Present
        </button>
        <button
          onClick={() => setAll("absent")}
          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors"
        >
          Mark All Absent
        </button>
      </div>

      {/* Roster */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">P / A / L</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Remark (if absent)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((student) => {
              const status = entries[student.id];
              return (
                <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{student.firstName} {student.lastName ?? ""}</p>
                    <p className="text-xs text-muted-foreground font-jetbrains">{student.studentCode}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-sm border ${STATUS_STYLES[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      {(["present", "absent", "leave"] as AttendanceStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setEntries((prev) => ({ ...prev, [student.id]: s }))}
                          className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${
                            status === s
                              ? STATUS_STYLES[s]
                              : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {status === "absent" ? (
                      <select
                        value={remarks[student.id] ?? ""}
                        onChange={(e) =>
                          setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        className="h-9 w-full min-w-[160px] px-2 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="">— Select reason —</option>
                        {remarkOptions.map((opt) => (
                          <option key={opt.id} value={opt.label}>
                            {opt.label}
                          </option>
                        ))}
                        {/* Preserve a previously-saved remark that is no longer in the options list */}
                        {remarks[student.id] &&
                          !remarkOptions.some((o) => o.label === remarks[student.id]) && (
                            <option value={remarks[student.id]}>{remarks[student.id]}</option>
                          )}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isPending || students.length === 0}
          className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {isPending ? "Saving..." : "Save Attendance"}
        </button>
      </div>
    </div>
  );
}
