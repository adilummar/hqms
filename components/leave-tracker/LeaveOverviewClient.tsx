"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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
type StudentWithEnrollments = {
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

interface Props {
  period: LeavePeriod;
  students: StudentWithEnrollments[];
  activities: Activity[];
  responses: Response[];
}

function getHifzClass(student: StudentWithEnrollments) {
  return student.enrollments.find((e) => e.class?.track === "hifz")?.class?.name ?? "";
}

function getDayLabel(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
    const activeActs = activities.filter((a) => a.isActive && !suspIds.has(a.id));
    for (const act of activeActs) {
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

export function LeaveOverviewClient({ period, students, activities, responses }: Props) {
  const [classFilter, setClassFilter] = useState<string>("all");

  const hifzClasses = Array.from(
    new Set(
      students
        .map((s) => getHifzClass(s))
        .filter(Boolean)
    )
  ).sort();

  const filteredStudents =
    classFilter === "all"
      ? students
      : students.filter((s) => getHifzClass(s) === classFilter);

  // Global stats
  const totalStudents = students.length;
  const overallScore = students.reduce(
    (acc, s) => {
      const sc = calcScore(s.id, null, period, activities, responses);
      return { yes: acc.yes + sc.yes, total: acc.total + sc.total };
    },
    { yes: 0, total: 0 }
  );
  const overallPct =
    overallScore.total > 0
      ? Math.round((overallScore.yes / overallScore.total) * 100)
      : 0;

  // By-class stats
  const classSummary = hifzClasses.map((cls) => {
    const clsStudents = students.filter((s) => getHifzClass(s) === cls);
    const sc = clsStudents.reduce(
      (acc, s) => {
        const ss = calcScore(s.id, null, period, activities, responses);
        return { yes: acc.yes + ss.yes, total: acc.total + ss.total };
      },
      { yes: 0, total: 0 }
    );
    return {
      cls,
      count: clsStudents.length,
      pct: sc.total > 0 ? Math.round((sc.yes / sc.total) * 100) : 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-jetbrains font-bold">{totalStudents}</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Students</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-jetbrains font-bold">{overallPct}%</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Overall</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-jetbrains font-bold">{period.days.length}</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Days</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-jetbrains font-bold">{activities.filter((a) => a.isActive).length}</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Activities</p>
        </div>
      </div>

      {/* Class filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setClassFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
            classFilter === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-muted-foreground border-border hover:border-foreground/30"
          )}
        >
          All Classes
        </button>
        {hifzClasses.map((cls) => (
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
            {cls}
          </button>
        ))}
      </div>

      {/* Class cards */}
      <div className="space-y-4">
        {(classFilter === "all" ? hifzClasses : [classFilter]).map((cls) => {
          const clsStudents = filteredStudents.filter((s) => getHifzClass(s) === cls);
          const summary = classSummary.find((c) => c.cls === cls);

          return (
            <div key={cls} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Class header */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div>
                  <p className="font-semibold text-sm">Class {cls}</p>
                  <p className="text-xs text-muted-foreground">{summary?.count} students</p>
                </div>
                <span className="font-jetbrains font-bold text-lg">{summary?.pct ?? 0}%</span>
              </div>

              {/* Heatmap */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs border-b border-border whitespace-nowrap min-w-[140px]">
                        Student
                      </th>
                      {period.days.map((day) => (
                        <th
                          key={day.dayNumber}
                          className="px-2 py-2 font-medium text-muted-foreground text-center border-b border-border whitespace-nowrap"
                        >
                          <div>D{day.dayNumber}</div>
                          <div className="text-[9px] opacity-60">{getDayLabel(day.date)}</div>
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium text-muted-foreground text-center border-b border-border">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clsStudents.map((student) => {
                      const overall = calcScore(student.id, null, period, activities, responses);
                      return (
                        <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                            {student.firstName} {student.lastName ?? ""}
                          </td>
                          {period.days.map((day) => {
                            const sc = calcScore(student.id, day.dayNumber, period, activities, responses);
                            const pct = sc.pct;
                            const intensity =
                              sc.total === 0
                                ? "bg-muted text-muted-foreground"
                                : pct === 100
                                ? "bg-foreground text-background"
                                : pct >= 80
                                ? "bg-foreground/80 text-background"
                                : pct >= 60
                                ? "bg-foreground/60 text-background"
                                : pct >= 40
                                ? "bg-foreground/30 text-foreground"
                                : pct > 0
                                ? "bg-foreground/15 text-foreground"
                                : "bg-muted/50 text-muted-foreground";
                            return (
                              <td key={day.dayNumber} className="px-1 py-2 text-center">
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-9 h-7 rounded text-[10px] font-jetbrains font-semibold",
                                    intensity
                                  )}
                                >
                                  {sc.total === 0 ? "—" : `${pct}%`}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            <span className="font-jetbrains font-bold text-sm">{overall.pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
