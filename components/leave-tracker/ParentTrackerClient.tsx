"use client";

import { useState, useCallback } from "react";
import { saveLeaveResponses } from "@/lib/actions/leave-tracker";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertCircle, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  isSuspendedOnHoliday: boolean;
  isActive: boolean;
};

type LeavePeriodDay = {
  id: string;
  leavePeriodId: string;
  dayNumber: number;
  date: string;
  label: string | null;
  suspensions: { activityId: string; activity: Activity }[];
};

type LeavePeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  days: LeavePeriodDay[];
};

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  className: string;
};

type Response = {
  dayNumber: number;
  activityId: string;
  completed: boolean;
};

interface ParentTrackerClientProps {
  period: LeavePeriod;
  student: Student;
  activities: Activity[];
  initialResponses: Response[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

function getDayOfWeek(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long" });
}

export function ParentTrackerClient({
  period,
  student,
  activities,
  initialResponses,
}: ParentTrackerClientProps) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, boolean>>>(() => {
    const map: Record<string, Record<string, boolean>> = {};
    for (const r of initialResponses) {
      if (!map[r.dayNumber]) map[r.dayNumber] = {};
      map[r.dayNumber][r.activityId] = r.completed;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const days = period.days ?? [];
  const currentDay = days[currentDayIndex];
  const dayNumber = currentDay?.dayNumber;

  const suspendedActivityIds = new Set(
    currentDay?.suspensions?.map((s) => s.activityId) ?? []
  );

  const activeActivities = activities.filter(
    (a) => a.isActive && !suspendedActivityIds.has(a.id)
  );
  const suspendedActivities = activities.filter(
    (a) => a.isActive && suspendedActivityIds.has(a.id)
  );

  const dayResponses = responses[dayNumber] ?? {};

  const completedCount = activeActivities.filter((a) => dayResponses[a.id]).length;
  const totalActive = activeActivities.length;
  const pct = totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;

  // Overall completion across all days
  const totalPossible = days.reduce((sum, day) => {
    const suspIds = new Set(day.suspensions?.map((s) => s.activityId) ?? []);
    return sum + activities.filter((a) => a.isActive && !suspIds.has(a.id)).length;
  }, 0);
  const totalDone = days.reduce((sum, day) => {
    const suspIds = new Set(day.suspensions?.map((s) => s.activityId) ?? []);
    const activeActs = activities.filter((a) => a.isActive && !suspIds.has(a.id));
    const dayResp = responses[day.dayNumber] ?? {};
    return sum + activeActs.filter((a) => dayResp[a.id]).length;
  }, 0);
  const overallPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  const toggleActivity = useCallback(
    (activityId: string) => {
      setResponses((prev) => {
        const dayMap = prev[dayNumber] ?? {};
        return {
          ...prev,
          [dayNumber]: {
            ...dayMap,
            [activityId]: !dayMap[activityId],
          },
        };
      });
      setSaveStatus("idle");
    },
    [dayNumber]
  );

  const handleSave = async () => {
    if (!currentDay) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const payload = activities
        .filter((a) => a.isActive && !suspendedActivityIds.has(a.id))
        .map((a) => ({
          activityId: a.id,
          completed: dayResponses[a.id] ?? false,
        }));

      const result = await saveLeaveResponses(period.id, student.id, dayNumber, payload);
      setSaveStatus(result.success ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  if (days.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No days configured for this leave period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Student welcome card */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-foreground/5 border border-border flex items-center justify-center flex-shrink-0">
            <span className="font-playfair text-xl font-bold text-foreground">
              {student.firstName.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-playfair text-lg font-semibold">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs text-muted-foreground font-jetbrains mt-0.5">
              {student.studentCode} {student.className && `· ${student.className}`}
            </p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium">Overall Leave Progress</span>
            <span className="font-jetbrains font-bold text-foreground">{overallPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalDone} / {totalPossible} activities completed
          </p>
        </div>
      </div>

      {/* Period info chip */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-jetbrains bg-muted px-3 py-1 rounded-full border border-border text-muted-foreground">
          {period.name}
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {period.startDate} → {period.endDate}
        </span>
      </div>

      {/* Day navigator */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
        <button
          onClick={() => setCurrentDayIndex((i) => Math.max(0, i - 1))}
          disabled={currentDayIndex === 0}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-playfair font-semibold text-base">
            Day {dayNumber}
            {currentDay.label && (
              <span className="ml-2 text-xs font-dm-sans font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">
                {currentDay.label}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(currentDay.date)}</p>
        </div>
        <button
          onClick={() => setCurrentDayIndex((i) => Math.min(days.length - 1, i + 1))}
          disabled={currentDayIndex === days.length - 1}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Suspension notice */}
      {suspendedActivities.length > 0 && (
        <div className="flex items-start gap-3 bg-[#C9A84C]/8 border border-[#C9A84C]/20 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="text-[#C9A84C] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {suspendedActivities.length === 1
                ? `"${suspendedActivities[0].name}" is`
                : `${suspendedActivities.map((a) => `"${a.name}"`).join(", ")} are`}{" "}
              suspended for Day {dayNumber}
            </p>
          </div>
        </div>
      )}

      {/* Day progress strip */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-dm-sans">
          {completedCount} / {totalActive} completed today
        </span>
        <span className="font-jetbrains font-bold text-foreground">{pct}%</span>
      </div>

      {/* Activities checklist */}
      <div className="space-y-2">
        {activeActivities.map((activity) => {
          const done = dayResponses[activity.id] ?? false;
          return (
            <button
              key={activity.id}
              onClick={() => toggleActivity(activity.id)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-all",
                done
                  ? "bg-foreground/[0.03] border-foreground/20"
                  : "bg-card border-border hover:border-foreground/20 hover:bg-muted/50"
              )}
            >
              {done ? (
                <CheckCircle2 size={22} className="flex-shrink-0 text-foreground" />
              ) : (
                <Circle size={22} className="flex-shrink-0 text-muted-foreground/40" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium text-sm", done ? "text-foreground" : "text-foreground/80")}>
                  {activity.name}
                </p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                )}
              </div>
              {done && (
                <span className="text-xs font-jetbrains text-foreground/50 bg-foreground/5 px-2 py-0.5 rounded-full flex-shrink-0">
                  Done
                </span>
              )}
            </button>
          );
        })}

        {/* Suspended activities (greyed out, not tappable) */}
        {suspendedActivities.map((activity) => (
          <div
            key={activity.id}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-muted/30 opacity-40 cursor-not-allowed"
          >
            <Circle size={22} className="flex-shrink-0 text-muted-foreground/30" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-muted-foreground line-through">
                {activity.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Suspended for this day</p>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Save button — sidebar-aware so it doesn't bleed under the nav */}
      <div className="fixed bottom-0 left-0 right-0 md:left-16 lg:left-64 z-40 pointer-events-none">
        <div className="px-4 pb-5 pt-8 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "w-full max-w-2xl mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-md",
              saving
                ? "bg-foreground/50 text-background cursor-not-allowed"
                : saveStatus === "saved"
                ? "bg-green-600 text-white"
                : saveStatus === "error"
                ? "bg-red-600 text-white"
                : "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
            )}
          >
            <Save size={15} />
            {saving
              ? "Saving…"
              : saveStatus === "saved"
              ? "✓ Saved!"
              : saveStatus === "error"
              ? "Error — Try again"
              : `Save Day ${dayNumber}`}
          </button>
        </div>
      </div>
    </div>

  );
}
