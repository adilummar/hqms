"use client";

import { useState, useTransition } from "react";
import { bulkMarkAttendance } from "@/lib/actions/attendance";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { applyToAll, type RosterStatus } from "@/lib/attendance/status";

type AttendanceStatus = RosterStatus;
type SessionType = "FN" | "AN";
type Track = "hifz" | "madrasa" | "school";

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
}

export interface ExistingEntry {
  studentId: string;
  session: SessionType | null; // null for legacy
  status: "present" | "absent" | "leave" | "friday" | "holiday";
  absenceReasonId?: string | null;
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
  friday: "F",
  holiday: "H",
  unmarked: "—",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-foreground text-background border-foreground",
  absent: "bg-red-50 text-red-700 border-red-300",
  friday: "bg-violet-50 text-violet-700 border-violet-300",
  holiday: "bg-sky-50 text-sky-700 border-sky-300",
  unmarked: "bg-background text-muted-foreground border-border hover:border-foreground/40",
};

const STATUS_TITLES: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  friday: "Friday (off day)",
  holiday: "Holiday (off day)",
  unmarked: "Clear / Unmarked",
};

export function AttendanceRoster({ students, classId, track, date, existingEntries, remarkOptions = [] }: Props) {
  const [isPending, startTransition] = useTransition();

  // We maintain independent state for FN and AN
  const [fnEntries, setFnEntries] = useState<Record<string, AttendanceStatus>>(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      const existing = existingEntries.find((e) => e.studentId === s.id && e.session === "FN");
      const legacy = existingEntries.find((e) => e.studentId === s.id && e.session === null);
      if (existing) {
        map[s.id] = existing.status === "leave" ? "absent" : existing.status;
      } else if (legacy) {
        // Do NOT falsely assume FN/AN Present. Just leave it unmarked so they can explicitly set it.
        map[s.id] = "unmarked";
      } else {
        map[s.id] = "unmarked";
      }
    }
    return map;
  });

  const [anEntries, setAnEntries] = useState<Record<string, AttendanceStatus>>(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const s of students) {
      const existing = existingEntries.find((e) => e.studentId === s.id && e.session === "AN");
      const legacy = existingEntries.find((e) => e.studentId === s.id && e.session === null);
      if (existing) {
        map[s.id] = existing.status === "leave" ? "absent" : existing.status;
      } else if (legacy) {
        map[s.id] = "unmarked";
      } else {
        map[s.id] = "unmarked";
      }
    }
    return map;
  });

  const [fnReasons, setFnReasons] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of students) {
      const existing = existingEntries.find((e) => e.studentId === s.id && e.session === "FN");
      map[s.id] = existing?.absenceReasonId ?? "";
    }
    return map;
  });

  const [anReasons, setAnReasons] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of students) {
      const existing = existingEntries.find((e) => e.studentId === s.id && e.session === "AN");
      map[s.id] = existing?.absenceReasonId ?? "";
    }
    return map;
  });

  const fnPresentCount = Object.values(fnEntries).filter((s) => s === "present").length;
  const fnAbsentCount = Object.values(fnEntries).filter((s) => s === "absent").length;
  const fnOffCount = Object.values(fnEntries).filter((s) => s === "friday" || s === "holiday").length;
  
  const anPresentCount = Object.values(anEntries).filter((s) => s === "present").length;
  const anAbsentCount = Object.values(anEntries).filter((s) => s === "absent").length;
  const anOffCount = Object.values(anEntries).filter((s) => s === "friday" || s === "holiday").length;

  // FN and AN are separate state objects: a bulk action on one session can never touch the other.
  function setAllFn(status: AttendanceStatus) {
    setFnEntries((prev) => applyToAll(prev, status));
  }

  function setAllAn(status: AttendanceStatus) {
    setAnEntries((prev) => applyToAll(prev, status));
  }

  async function handleSave() {
    startTransition(async () => {
      const payloadEntries = [];

      for (const student of students) {
        const studentId = student.id;
        const fnStatus = fnEntries[studentId];
        const anStatus = anEntries[studentId];

        payloadEntries.push({
          studentId,
          session: "FN" as const,
          status: fnStatus,
          absenceReasonId: fnStatus === "absent" ? fnReasons[studentId] || "" : "",
        });

        payloadEntries.push({
          studentId,
          session: "AN" as const,
          status: anStatus,
          absenceReasonId: anStatus === "absent" ? anReasons[studentId] || "" : "",
        });
      }

      const result = await bulkMarkAttendance({
        classId,
        track,
        date,
        entries: payloadEntries,
      });

      if (result.success) {
        toast.success(`Attendance saved`);
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Failed to save attendance");
      }
    });
  }

  // To highlight if there are legacy records waiting to be replaced
  const hasLegacy = existingEntries.some(e => e.session === null);

  return (
    <div className="space-y-4">
      {hasLegacy && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-md">
          <strong>Notice:</strong> This date contains legacy full-day attendance records. They are currently displayed as Unmarked below. Please select the specific Forenoon (FN) and Afternoon (AN) statuses and save to explicitly convert them.
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-r border-border pr-4">
            <span className="font-semibold text-muted-foreground">FN:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-sm bg-foreground text-background text-xs flex items-center justify-center font-medium">P</span>
              <span className="text-muted-foreground">{fnPresentCount}</span>
            </span>
            <span className="flex items-center gap-1.5 ml-2">
              <span className="w-5 h-5 rounded-sm bg-red-50 text-red-700 border border-red-300 text-xs flex items-center justify-center font-medium">A</span>
              <span className="text-muted-foreground">{fnAbsentCount}</span>
            </span>
            {fnOffCount > 0 && <span className="ml-2 text-xs text-muted-foreground">{fnOffCount} off</span>}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">AN:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-sm bg-foreground text-background text-xs flex items-center justify-center font-medium">P</span>
              <span className="text-muted-foreground">{anPresentCount}</span>
            </span>
            <span className="flex items-center gap-1.5 ml-2">
              <span className="w-5 h-5 rounded-sm bg-red-50 text-red-700 border border-red-300 text-xs flex items-center justify-center font-medium">A</span>
              <span className="text-muted-foreground">{anAbsentCount}</span>
            </span>
            {anOffCount > 0 && <span className="ml-2 text-xs text-muted-foreground">{anOffCount} off</span>}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2 pb-2 border-b border-border">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forenoon (FN)</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAllFn("present")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Present</button>
            <button onClick={() => setAllFn("absent")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Absent</button>
            <button onClick={() => setAllFn("friday")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Friday</button>
            <button onClick={() => setAllFn("holiday")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Holiday</button>
            <button onClick={() => setAllFn("unmarked")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors text-muted-foreground">Clear All</button>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Afternoon (AN)</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAllAn("present")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Present</button>
            <button onClick={() => setAllAn("absent")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Absent</button>
            <button onClick={() => setAllAn("friday")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Friday</button>
            <button onClick={() => setAllAn("holiday")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors">All Holiday</button>
            <button onClick={() => setAllAn("unmarked")} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors text-muted-foreground">Clear All</button>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground min-w-[150px]">Student</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground border-l border-border bg-muted/30">Forenoon (FN)</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground border-l border-border bg-muted/30">Afternoon (AN)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((student) => {
              const fnStatus = fnEntries[student.id];
              const anStatus = anEntries[student.id];
              
              return (
                <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{student.firstName} {student.lastName ?? ""}</p>
                    <p className="text-xs text-muted-foreground font-jetbrains">{student.studentCode}</p>
                  </td>
                  
                  {/* FN Column */}
                  <td className="px-4 py-3 border-l border-border bg-muted/10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex justify-center gap-1">
                        {(["present", "absent", "friday", "holiday", "unmarked"] as AttendanceStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setFnEntries((prev) => ({ ...prev, [student.id]: s }))}
                            title={STATUS_TITLES[s]}
                            className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${
                              fnStatus === s
                                ? STATUS_STYLES[s]
                                : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      {fnStatus === "absent" && (
                        <select
                          value={fnReasons[student.id] ?? ""}
                          onChange={(e) => setFnReasons((prev) => ({ ...prev, [student.id]: e.target.value }))}
                          className="h-8 w-full max-w-[160px] px-2 text-xs border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                        >
                          <option value="">— Reason —</option>
                          {remarkOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                          {/* Preserve existing reason if not in active options */}
                          {fnReasons[student.id] && !remarkOptions.some((o) => o.id === fnReasons[student.id]) && (
                            <option value={fnReasons[student.id]}>Archived Reason</option>
                          )}
                        </select>
                      )}
                    </div>
                  </td>

                  {/* AN Column */}
                  <td className="px-4 py-3 border-l border-border bg-muted/10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex justify-center gap-1">
                        {(["present", "absent", "friday", "holiday", "unmarked"] as AttendanceStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setAnEntries((prev) => ({ ...prev, [student.id]: s }))}
                            title={STATUS_TITLES[s]}
                            className={`w-8 h-8 text-xs font-bold rounded-sm border transition-all ${
                              anStatus === s
                                ? STATUS_STYLES[s]
                                : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      {anStatus === "absent" && (
                        <select
                          value={anReasons[student.id] ?? ""}
                          onChange={(e) => setAnReasons((prev) => ({ ...prev, [student.id]: e.target.value }))}
                          className="h-8 w-full max-w-[160px] px-2 text-xs border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                        >
                          <option value="">— Reason —</option>
                          {remarkOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                          {/* Preserve existing reason if not in active options */}
                          {anReasons[student.id] && !remarkOptions.some((o) => o.id === anReasons[student.id]) && (
                            <option value={anReasons[student.id]}>Archived Reason</option>
                          )}
                        </select>
                      )}
                    </div>
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
