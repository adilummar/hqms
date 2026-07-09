"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, X } from "lucide-react";

type Activity = { id: string; name: string; isActive: boolean };
type LeavePeriodDay = {
  id: string; dayNumber: number; date: string; label: string | null;
  suspensions: { activityId: string }[];
};
type LeavePeriod = { id: string; name: string; days: LeavePeriodDay[] };
type Enrollment = { class?: { name?: string; track?: string } };
type Student = {
  id: string; firstName: string; lastName: string | null;
  studentCode: string; enrollments: Enrollment[];
};
type Response = {
  studentId: string; dayNumber: number; activityId: string; completed: boolean;
};
interface Props {
  period: LeavePeriod; students: Student[];
  activities: Activity[]; responses: Response[];
}

function getHifzClass(s: Student) {
  return s.enrollments.find((e) => e.class?.track === "hifz")?.class?.name ?? "";
}
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function LeaveAnalysisClient({ period, students, activities, responses }: Props) {
  const [selectedDayNum, setSelectedDayNum] = useState<number>(period.days[0]?.dayNumber ?? 1);
  const [selectedActId, setSelectedActId] = useState<string>(activities.find((a) => a.isActive)?.id ?? "");
  const [view, setView] = useState<"completed" | "pending">("completed");

  const currentDay = period.days.find((d) => d.dayNumber === selectedDayNum);
  const suspIds = new Set(currentDay?.suspensions?.map((s) => s.activityId) ?? []);
  const isActSuspended = suspIds.has(selectedActId);

  const relevantStudents = students.filter((s) => !isActSuspended);

  const completed = relevantStudents.filter((s) =>
    responses.some(
      (r) =>
        r.studentId === s.id &&
        r.dayNumber === selectedDayNum &&
        r.activityId === selectedActId &&
        r.completed
    )
  );
  const pending = relevantStudents.filter(
    (s) => !completed.find((c) => c.id === s.id)
  );

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Select Day</label>
          <select
            value={selectedDayNum}
            onChange={(e) => setSelectedDayNum(Number(e.target.value))}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {period.days.map((day) => (
              <option key={day.dayNumber} value={day.dayNumber}>
                Day {day.dayNumber} — {formatDate(day.date)}{day.label ? ` (${day.label})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Select Activity</label>
          <select
            value={selectedActId}
            onChange={(e) => setSelectedActId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {activities.filter((a) => a.isActive).map((act) => (
              <option key={act.id} value={act.id}>{act.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isActSuspended ? (
        <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/20 rounded-lg p-4 text-sm text-center">
          This activity is suspended on Day {selectedDayNum}.
        </div>
      ) : (
        <>
          {/* Mobile toggle */}
          <div className="flex sm:hidden bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setView("completed")}
              className={cn("flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                view === "completed" ? "bg-card shadow text-foreground" : "text-muted-foreground")}
            >
              <CheckCircle2 size={13} /> Completed ({completed.length})
            </button>
            <button
              onClick={() => setView("pending")}
              className={cn("flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                view === "pending" ? "bg-card shadow text-foreground" : "text-muted-foreground")}
            >
              <XCircle size={13} /> Not Done ({pending.length})
            </button>
          </div>

          {/* Split panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Completed */}
            <div className={cn("bg-card border border-border rounded-lg overflow-hidden", view === "pending" ? "hidden sm:block" : "")}>
              <div className="px-4 py-3 border-b border-border bg-green-50 dark:bg-green-950/20 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                  Completed ({completed.length})
                </span>
              </div>
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {completed.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{s.firstName} {s.lastName ?? ""}</p>
                      <p className="text-xs text-muted-foreground font-jetbrains">{getHifzClass(s)}</p>
                    </div>
                    <span className="text-xs font-jetbrains bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                      Done
                    </span>
                  </div>
                ))}
                {completed.length === 0 && (
                  <div className="px-4 py-6 text-center text-muted-foreground text-sm">None yet</div>
                )}
              </div>
            </div>

            {/* Not completed */}
            <div className={cn("bg-card border border-border rounded-lg overflow-hidden", view === "completed" ? "hidden sm:block" : "")}>
              <div className="px-4 py-3 border-b border-border bg-red-50 dark:bg-red-950/20 flex items-center gap-2">
                <XCircle size={14} className="text-red-500" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                  Not Done ({pending.length})
                </span>
              </div>
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {pending.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{s.firstName} {s.lastName ?? ""}</p>
                      <p className="text-xs text-muted-foreground font-jetbrains">{getHifzClass(s)}</p>
                    </div>
                    <span className="text-xs font-jetbrains bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  </div>
                ))}
                {pending.length === 0 && (
                  <div className="px-4 py-6 text-center text-muted-foreground text-sm">All completed!</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
