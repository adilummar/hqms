"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";

type Activity = { id: string; name: string; isActive: boolean };
type LeavePeriodDay = {
  id: string;
  dayNumber: number;
  date: string;
  label: string | null;
  suspensions: { activityId: string }[];
};
type LeavePeriod = { id: string; name: string; days: LeavePeriodDay[] };
type Enrollment = { class?: { name?: string; track?: string } };
type Student = {
  id: string;
  firstName: string;
  lastName: string | null;
  studentCode: string;
  enrollments: Enrollment[];
};
type Response = {
  studentId: string;
  dayNumber: number;
  activityId: string;
  completed: boolean;
};

function getHifzClass(student: Student) {
  return student.enrollments.find((e) => e.class?.track === "hifz")?.class?.name ?? "";
}

function calcScore(
  studentId: string,
  dayNumber: number | null,
  period: LeavePeriod,
  activities: Activity[],
  responses: Response[]
) {
  const days = dayNumber
    ? period.days.filter((d) => d.dayNumber === dayNumber)
    : period.days;
  let yes = 0, total = 0;
  for (const day of days) {
    const suspIds = new Set(day.suspensions.map((s) => s.activityId));
    const acts = activities.filter((a) => a.isActive && !suspIds.has(a.id));
    for (const act of acts) {
      total++;
      const r = responses.find(
        (r) =>
          r.studentId === studentId &&
          r.dayNumber === day.dayNumber &&
          r.activityId === act.id
      );
      if (r?.completed) yes++;
    }
  }
  return { yes, total, pct: total > 0 ? Math.round((yes / total) * 100) : 0 };
}

interface Props {
  period: LeavePeriod;
  students: Student[];
  activities: Activity[];
  responses: Response[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function LeaveStudentsClient({ period, students, activities, responses }: Props) {
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const hifzClasses = Array.from(
    new Set(students.map((s) => getHifzClass(s)).filter(Boolean))
  ).sort();

  const filtered = students
    .filter((s) => {
      if (classFilter !== "all" && getHifzClass(s) !== classFilter) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        s.firstName.toLowerCase().includes(q) ||
        (s.lastName ?? "").toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q)
      );
    })
    .map((s) => ({ ...s, score: calcScore(s.id, null, period, activities, responses) }))
    .sort((a, b) => b.score.pct - a.score.pct);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
        />
        <div className="flex gap-2 flex-wrap">
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
              {cls === "all" ? "All" : cls}
            </button>
          ))}
        </div>
      </div>

      {/* Student list */}
      <div className="space-y-2">
        {filtered.map((student, index) => (
          <button
            key={student.id}
            onClick={() => setSelectedStudent(student)}
            className="w-full bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4 hover:border-foreground/20 hover:bg-muted/30 transition-all text-left"
          >
            <span className="w-6 h-6 rounded-full bg-muted border border-border text-xs font-jetbrains font-bold text-muted-foreground flex items-center justify-center flex-shrink-0">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {student.firstName} {student.lastName ?? ""}
              </p>
              <p className="text-xs text-muted-foreground font-jetbrains mt-0.5">
                {student.studentCode} · {getHifzClass(student)}
              </p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${student.score.pct}%` }}
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-jetbrains font-bold text-lg">{student.score.pct}%</p>
              <p className="text-xs text-muted-foreground">
                {student.score.yes}/{student.score.total}
              </p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No students found.</div>
        )}
      </div>

      {/* Student detail modal */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-playfair font-semibold text-lg">
                  {selectedStudent.firstName} {selectedStudent.lastName ?? ""}
                </p>
                <p className="text-xs text-muted-foreground font-jetbrains">
                  {selectedStudent.studentCode} · {getHifzClass(selectedStudent)}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            {/* Day-by-day table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground border-b border-border">Activity</th>
                    {period.days.map((day) => (
                      <th key={day.dayNumber} className="px-3 py-2.5 text-center font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                        <div>Day {day.dayNumber}</div>
                        <div className="text-[9px] opacity-60">{formatDate(day.date)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activities.filter((a) => a.isActive).map((act) => (
                    <tr key={act.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{act.name}</td>
                      {period.days.map((day) => {
                        const suspIds = new Set(day.suspensions.map((s) => s.activityId));
                        if (suspIds.has(act.id)) {
                          return (
                            <td key={day.dayNumber} className="px-3 py-2.5 text-center text-muted-foreground/40 italic">
                              —
                            </td>
                          );
                        }
                        const r = responses.find(
                          (r) =>
                            r.studentId === selectedStudent.id &&
                            r.dayNumber === day.dayNumber &&
                            r.activityId === act.id
                        );
                        return (
                          <td key={day.dayNumber} className="px-3 py-2.5 text-center">
                            {r?.completed ? (
                              <span className="text-foreground font-bold">✓</span>
                            ) : r ? (
                              <span className="text-muted-foreground/50">✗</span>
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
