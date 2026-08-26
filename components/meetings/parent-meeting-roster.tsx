"use client";

import { useState, useTransition } from "react";
import { saveParentMeetingAttendance } from "@/lib/actions/parent-meetings";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
}

interface ExistingEntry {
  studentId: string;
  attended: boolean;
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

type AttendanceMap = Record<string, boolean | null>; // null = not marked
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
      map[s.id] = existing ? existing.attended : null;
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

  const attendedCount = Object.values(attendance).filter((v) => v === true).length;
  const absentCount = Object.values(attendance).filter((v) => v === false).length;
  const unmarkedCount = Object.values(attendance).filter((v) => v === null).length;

  function markAll(attended: boolean) {
    setAttendance((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = attended;
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const entries = students.map((s) => ({
        studentId: s.id,
        attended: attendance[s.id] ?? false,
        remarks: remarks[s.id] ?? "",
      }));

      const result = await saveParentMeetingAttendance({
        meetingId,
        entries,
        extraRevalidatePaths: revalidatePaths,
      });

      if (result.success) {
        toast.success(`Attendance saved — ${attendedCount} attended, ${absentCount} absent`);
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
          <p>{attendedCount} attended</p>
          <p>{absentCount} absent</p>
          {unmarkedCount > 0 && <p className="text-amber-500">{unmarkedCount} unmarked</p>}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => markAll(true)}
          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <CheckCircle2 size={12} className="text-emerald-600" />
          Mark All Attended
        </button>
        <button
          onClick={() => markAll(false)}
          className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <XCircle size={12} className="text-red-500" />
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
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Parent Attended?</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Remarks (if absent)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((student) => {
              const attended = attendance[student.id];
              const showRemarks = attended === false;

              return (
                <tr
                  key={student.id}
                  className={`transition-colors ${attended === false ? "bg-red-50/40" : attended === true ? "bg-emerald-50/30" : "hover:bg-muted/20"}`}
                >
                  {/* Student info */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {student.firstName} {student.lastName ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground font-jetbrains">{student.studentCode}</p>
                  </td>

                  {/* Yes / No toggle */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        id={`attend-yes-${student.id}`}
                        onClick={() =>
                          setAttendance((prev) => ({ ...prev, [student.id]: true }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold border transition-all ${
                          attended === true
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-background text-muted-foreground border-border hover:border-emerald-400 hover:text-emerald-700"
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        Yes
                      </button>
                      <button
                        id={`attend-no-${student.id}`}
                        onClick={() =>
                          setAttendance((prev) => ({ ...prev, [student.id]: false }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold border transition-all ${
                          attended === false
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-background text-muted-foreground border-border hover:border-red-400 hover:text-red-700"
                        }`}
                      >
                        <XCircle size={12} />
                        No
                      </button>
                    </div>
                  </td>

                  {/* Remarks — only visible when No is selected */}
                  <td className="px-4 py-3">
                    <div
                      className={`transition-all duration-200 overflow-hidden ${
                        showRemarks ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <textarea
                        id={`remarks-${student.id}`}
                        value={remarks[student.id] ?? ""}
                        onChange={(e) =>
                          setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))
                        }
                        placeholder="Reason for absence..."
                        rows={2}
                        className="w-full text-xs px-2 py-1.5 border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                      />
                    </div>
                    {!showRemarks && attended === true && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {attended === null && (
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
        {unmarkedCount > 0 && (
          <p className="text-xs text-amber-600">
            ⚠ {unmarkedCount} student{unmarkedCount > 1 ? "s" : ""} not yet marked — will be saved as absent.
          </p>
        )}
        <div className="ml-auto">
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
    </div>
  );
}
