"use client";

import { useState, useTransition } from "react";
import { saveParentMeetingAttendance } from "@/lib/actions/parent-meetings";
import { toast } from "sonner";
import { Loader2, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
}

interface ExistingEntry {
  studentId: string;
  attended: boolean | null;
  status: string | null;
  remarks: string | null;
}

interface Props {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  students: Student[];
  existingAttendance: ExistingEntry[];
  /** Extra paths to revalidate after saving (e.g. admin page) */
  revalidatePaths?: string[];
}

type StatusEnum = "ON_TIME" | "LATE" | "ABSENT_WITH_REASON" | "ABSENT_WITHOUT_VALID_REASON" | "LEGACY_YES" | "LEGACY_NO";
type AttendanceMap = Record<string, StatusEnum | null>; // null = not marked
type RemarksMap = Record<string, string>;

export function ParentMeetingRoster({
  meetingId,
  meetingTitle,
  meetingDate,
  students,
  existingAttendance,
  revalidatePaths,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [attendance, setAttendance] = useState<AttendanceMap>(() => {
    const map: AttendanceMap = {};
    for (const s of students) {
      const existing = existingAttendance.find((e) => e.studentId === s.id);
      if (existing) {
        if (existing.status) {
          map[s.id] = existing.status as StatusEnum;
        } else if (existing.attended !== null) {
          map[s.id] = existing.attended ? "LEGACY_YES" : "LEGACY_NO";
        } else {
          map[s.id] = null;
        }
      } else {
        map[s.id] = null;
      }
    }
    return map;
  });

  const [remarks, setRemarks] = useState<RemarksMap>(() => {
    const map: RemarksMap = {};
    for (const entry of existingAttendance) {
      if (entry.remarks) map[entry.studentId] = entry.remarks;
    }
    return map;
  });

  const stats = {
    onTime: Object.values(attendance).filter((v) => v === "ON_TIME").length,
    late: Object.values(attendance).filter((v) => v === "LATE").length,
    absentReason: Object.values(attendance).filter((v) => v === "ABSENT_WITH_REASON").length,
    absentNoReason: Object.values(attendance).filter((v) => v === "ABSENT_WITHOUT_VALID_REASON").length,
    legacy: Object.values(attendance).filter((v) => v === "LEGACY_YES" || v === "LEGACY_NO").length,
    unmarked: Object.values(attendance).filter((v) => v === null).length,
  };

  function markAll(status: StatusEnum) {
    setAttendance((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
         if (next[key] !== "LEGACY_YES" && next[key] !== "LEGACY_NO") {
             next[key] = status;
         }
      }
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      // Only send records that have been updated to a valid new status.
      // We don't resave legacy records unless the user explicitly changed them to a new status.
      const entries = students
        .filter((s) => {
            const status = attendance[s.id];
            return status !== null && status !== "LEGACY_YES" && status !== "LEGACY_NO";
        })
        .map((s) => ({
          studentId: s.id,
          status: attendance[s.id] as "ON_TIME" | "LATE" | "ABSENT_WITH_REASON" | "ABSENT_WITHOUT_VALID_REASON",
          remarks: remarks[s.id] ?? "",
        }));

      if (entries.length === 0) {
         toast.error("No valid attendance entries to save.");
         return;
      }

      const result = await saveParentMeetingAttendance({
        meetingId,
        entries,
        extraRevalidatePaths: revalidatePaths,
      });

      if (result.success) {
        toast.success(`Attendance saved successfully (${entries.length} records)`);
      } else {
        toast.error("Failed to save attendance");
      }
    });
  }

  const formattedDate = new Date(meetingDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Meeting info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-amber-900 text-sm">{meetingTitle}</p>
          <p className="text-xs text-amber-700 mt-0.5">{formattedDate}</p>
        </div>
        <div className="text-right text-xs text-amber-700">
          <p>On Time: {stats.onTime} | Late: {stats.late}</p>
          <p>Absent: {stats.absentReason + stats.absentNoReason}</p>
          {stats.legacy > 0 && <p className="text-amber-500">{stats.legacy} legacy records</p>}
          {stats.unmarked > 0 && <p className="text-amber-500">{stats.unmarked} unmarked</p>}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => markAll("ON_TIME")}
          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <CheckCircle2 size={12} className="text-emerald-600" />
          Mark All On Time
        </button>
        <button
          onClick={() => markAll("LATE")}
          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <Clock size={12} className="text-blue-600" />
          Mark All Late
        </button>
      </div>

      {/* Roster */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Student / Parent</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Attendance Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason / Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((student) => {
              const status = attendance[student.id];
              const showRemarks = status === "ABSENT_WITH_REASON" || status === "ABSENT_WITHOUT_VALID_REASON" || status === "LATE";
              const isLegacy = status === "LEGACY_YES" || status === "LEGACY_NO";

              return (
                <tr
                  key={student.id}
                  className={`transition-colors hover:bg-muted/20`}
                >
                  {/* Student info */}
                  <td className="px-4 py-3 align-top min-w-[150px]">
                    <p className="font-medium text-foreground">
                      {student.firstName} {student.lastName ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground font-jetbrains">{student.studentCode}</p>
                    {isLegacy && (
                        <p className="text-[10px] uppercase font-bold mt-2 text-amber-600 bg-amber-100 inline-block px-2 py-0.5 rounded">
                           Legacy: {status === "LEGACY_YES" ? "Attended" : "Not Attended"}
                        </p>
                    )}
                  </td>

                  {/* Status Selection */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setAttendance((prev) => ({ ...prev, [student.id]: "ON_TIME" }))}
                            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-semibold border transition-all ${
                              status === "ON_TIME"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-background text-muted-foreground border-border hover:border-emerald-400 hover:text-emerald-700"
                            }`}
                          >
                            <CheckCircle2 size={12} /> On Time
                          </button>
                          <button
                            onClick={() => setAttendance((prev) => ({ ...prev, [student.id]: "LATE" }))}
                            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-semibold border transition-all ${
                              status === "LATE"
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-background text-muted-foreground border-border hover:border-blue-400 hover:text-blue-700"
                            }`}
                          >
                            <Clock size={12} /> Late
                          </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setAttendance((prev) => ({ ...prev, [student.id]: "ABSENT_WITH_REASON" }))}
                            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-semibold border transition-all ${
                              status === "ABSENT_WITH_REASON"
                                ? "bg-yellow-500 text-white border-yellow-500"
                                : "bg-background text-muted-foreground border-border hover:border-yellow-400 hover:text-yellow-700"
                            }`}
                          >
                            <AlertCircle size={12} /> Absent (Reason)
                          </button>
                          <button
                            onClick={() => setAttendance((prev) => ({ ...prev, [student.id]: "ABSENT_WITHOUT_VALID_REASON" }))}
                            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-semibold border transition-all ${
                              status === "ABSENT_WITHOUT_VALID_REASON"
                                ? "bg-red-600 text-white border-red-600"
                                : "bg-background text-muted-foreground border-border hover:border-red-400 hover:text-red-700"
                            }`}
                          >
                            <XCircle size={12} /> Absent (No Reason)
                          </button>
                      </div>
                    </div>
                  </td>

                  {/* Remarks */}
                  <td className="px-4 py-3 align-top min-w-[200px]">
                    <div
                      className={`transition-all duration-200 overflow-hidden ${
                        showRemarks || (isLegacy && remarks[student.id]) ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <textarea
                        value={remarks[student.id] ?? ""}
                        onChange={(e) =>
                          setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        placeholder={status === "ABSENT_WITH_REASON" ? "Required reason for absence..." : "Optional remarks..."}
                        rows={2}
                        className={`w-full text-xs px-2 py-1.5 border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground resize-none ${
                            status === "ABSENT_WITH_REASON" && !(remarks[student.id]?.trim()) ? "border-red-400" : "border-border"
                        }`}
                      />
                      {status === "ABSENT_WITH_REASON" && !(remarks[student.id]?.trim()) && (
                          <p className="text-[10px] text-red-500 mt-0.5">Reason is required</p>
                      )}
                    </div>
                    {!showRemarks && !isLegacy && status !== null && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {status === null && (
                      <span className="text-xs text-amber-500">Not marked</span>
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
      <div className="flex items-center justify-between pt-2">
        <div>
            {stats.unmarked > 0 && (
            <p className="text-xs text-amber-600">
                ⚠ {stats.unmarked} student{stats.unmarked > 1 ? "s" : ""} not yet marked. They will NOT be saved automatically.
            </p>
            )}
            {stats.legacy > 0 && (
            <p className="text-xs text-amber-600">
                ℹ️ {stats.legacy} legacy records found. You must update them to a new status to overwrite them.
            </p>
            )}
        </div>
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={
                isPending || 
                students.length === 0 || 
                Object.entries(attendance).some(([id, st]) => st === "ABSENT_WITH_REASON" && !(remarks[id]?.trim()))
            }
            className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}
