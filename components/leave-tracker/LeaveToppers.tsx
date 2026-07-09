"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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
function calcScore(
  studentId: string,
  dayNumber: number | null,
  period: LeavePeriod,
  activities: Activity[],
  responses: Response[]
) {
  const days = dayNumber ? period.days.filter((d) => d.dayNumber === dayNumber) : period.days;
  let yes = 0, total = 0;
  for (const day of days) {
    const suspIds = new Set(day.suspensions.map((s) => s.activityId));
    const acts = activities.filter((a) => a.isActive && !suspIds.has(a.id));
    for (const act of acts) {
      total++;
      if (responses.find((r) => r.studentId === studentId && r.dayNumber === day.dayNumber && r.activityId === act.id && r.completed)) yes++;
    }
  }
  return { yes, total, pct: total > 0 ? Math.round((yes / total) * 100) : 0 };
}

const RANK_STYLES = [
  { badge: "bg-[#FFD700]/20 text-[#B8860B] border-[#FFD700]/40", label: "🥇 1st" },
  { badge: "bg-zinc-200/50 text-zinc-600 border-zinc-300", label: "🥈 2nd" },
  { badge: "bg-amber-700/20 text-amber-800 border-amber-700/40", label: "🥉 3rd" },
];

export function LeaveToppers({ period, students, activities, responses }: Props) {
  const [view, setView] = useState<"overall" | "daily">("overall");
  const [selectedDayNum, setSelectedDayNum] = useState<number>(period.days[0]?.dayNumber ?? 1);
  const [classFilter, setClassFilter] = useState<string>("all");

  const hifzClasses = Array.from(new Set(students.map((s) => getHifzClass(s)).filter(Boolean))).sort();

  const filtered = classFilter === "all" ? students : students.filter((s) => getHifzClass(s) === classFilter);

  const ranked = filtered
    .map((s) => ({
      ...s,
      score: calcScore(s.id, view === "daily" ? selectedDayNum : null, period, activities, responses),
    }))
    .sort((a, b) => b.score.pct - a.score.pct)
    .filter((s) => s.score.yes > 0);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          <button
            onClick={() => setView("overall")}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              view === "overall" ? "bg-card shadow text-foreground" : "text-muted-foreground")}
          >
            Overall
          </button>
          <button
            onClick={() => setView("daily")}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              view === "daily" ? "bg-card shadow text-foreground" : "text-muted-foreground")}
          >
            Daily
          </button>
        </div>
        {view === "daily" && (
          <select
            value={selectedDayNum}
            onChange={(e) => setSelectedDayNum(Number(e.target.value))}
            className="px-3 py-1.5 text-xs border border-border rounded-lg bg-card outline-none"
          >
            {period.days.map((day) => (
              <option key={day.dayNumber} value={day.dayNumber}>
                Day {day.dayNumber} — {formatDate(day.date)}
              </option>
            ))}
          </select>
        )}
        {["all", ...hifzClasses].map((cls) => (
          <button
            key={cls}
            onClick={() => setClassFilter(cls)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              classFilter === cls
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            )}
          >
            {cls === "all" ? "All Classes" : cls}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Trophy size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No responses recorded yet.</p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          {ranked.length >= 3 && (
            <div className="bg-gradient-to-b from-[#C9A84C]/5 to-transparent border border-[#C9A84C]/20 rounded-xl p-6">
              <div className="flex items-end justify-center gap-3">
                {/* 2nd */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-12 h-12 rounded-full bg-zinc-200/40 border-2 border-zinc-300 flex items-center justify-center font-bold text-sm mb-2">
                    {ranked[1].firstName.charAt(0)}
                  </div>
                  <p className="text-xs font-medium text-center truncate w-full">{ranked[1].firstName}</p>
                  <p className="text-xs text-muted-foreground">{getHifzClass(ranked[1])}</p>
                  <div className="w-full bg-zinc-200/50 border border-zinc-300 rounded-t-md mt-2 h-16 flex items-center justify-center">
                    <span className="text-sm font-bold font-jetbrains">{ranked[1].score.pct}%</span>
                  </div>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center flex-1">
                  <div className="text-lg mb-1">👑</div>
                  <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 border-2 border-[#FFD700]/60 flex items-center justify-center font-bold text-lg mb-2">
                    {ranked[0].firstName.charAt(0)}
                  </div>
                  <p className="text-xs font-bold text-center truncate w-full">{ranked[0].firstName}</p>
                  <p className="text-xs text-muted-foreground">{getHifzClass(ranked[0])}</p>
                  <div className="w-full bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-t-md mt-2 h-24 flex items-center justify-center">
                    <span className="text-base font-bold font-jetbrains text-[#B8860B]">{ranked[0].score.pct}%</span>
                  </div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-12 h-12 rounded-full bg-amber-700/10 border-2 border-amber-700/30 flex items-center justify-center font-bold text-sm mb-2">
                    {ranked[2].firstName.charAt(0)}
                  </div>
                  <p className="text-xs font-medium text-center truncate w-full">{ranked[2].firstName}</p>
                  <p className="text-xs text-muted-foreground">{getHifzClass(ranked[2])}</p>
                  <div className="w-full bg-amber-700/10 border border-amber-700/20 rounded-t-md mt-2 h-12 flex items-center justify-center">
                    <span className="text-sm font-bold font-jetbrains">{ranked[2].score.pct}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full ranked list */}
          <div className="space-y-2">
            {ranked.map((student, index) => {
              const rs = RANK_STYLES[index] ?? { badge: "bg-muted text-muted-foreground border-border", label: `#${index + 1}` };
              return (
                <div key={student.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                  <span className={cn("text-xs font-bold font-jetbrains px-2 py-0.5 rounded-full border flex-shrink-0 min-w-[40px] text-center", rs.badge)}>
                    {rs.label ?? `#${index + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{student.firstName} {student.lastName ?? ""}</p>
                    <p className="text-xs text-muted-foreground font-jetbrains">{getHifzClass(student)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-jetbrains font-bold">{student.score.pct}%</p>
                    <p className="text-xs text-muted-foreground">{student.score.yes}/{student.score.total}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
