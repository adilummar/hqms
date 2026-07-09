"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, CheckCircle, Circle, Edit2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createLeavePeriod,
  activateLeavePeriod,
  deleteLeavePeriod,
  createLeaveActivity,
  updateLeaveActivity,
  deleteLeaveActivity,
  toggleActivitySuspension,
  updateDayLabel,
} from "@/lib/actions/leave-tracker";
import { useRouter } from "next/navigation";

type Activity = {
  id: string; name: string; description: string | null; icon: string | null;
  displayOrder: number; isSuspendedOnHoliday: boolean; isActive: boolean;
};
type Suspension = { activityId: string; activity?: Activity };
type Day = {
  id: string; dayNumber: number; date: string; label: string | null;
  suspensions: Suspension[];
};
type LeavePeriod = {
  id: string; name: string; startDate: string; endDate: string;
  isActive: boolean; days: Day[];
};
interface Props { periods: LeavePeriod[]; activities: Activity[] }

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function LeaveSettingsClient({ periods, activities }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  
  // New period form
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [periodError, setPeriodError] = useState("");

  // New activity form
  const [newActName, setNewActName] = useState("");
  const [newActDesc, setNewActDesc] = useState("");
  const [newActHoliday, setNewActHoliday] = useState(false);
  const [actError, setActError] = useState("");

  const handleCreatePeriod = () => {
    setPeriodError("");
    if (!newName || !newStart || !newEnd) { setPeriodError("All fields required."); return; }
    if (new Date(newEnd) < new Date(newStart)) { setPeriodError("End date must be after start date."); return; }
    startTransition(async () => {
      const r = await createLeavePeriod({ name: newName, startDate: newStart, endDate: newEnd });
      if (r.success) { setNewName(""); setNewStart(""); setNewEnd(""); router.refresh(); }
      else setPeriodError("Failed to create period.");
    });
  };

  const handleActivate = (id: string) => {
    startTransition(async () => { await activateLeavePeriod(id); router.refresh(); });
  };

  const handleDeletePeriod = (id: string) => {
    if (!confirm("Delete this leave period? All responses will also be deleted.")) return;
    startTransition(async () => { await deleteLeavePeriod(id); router.refresh(); });
  };

  const handleCreateActivity = () => {
    setActError("");
    if (!newActName) { setActError("Activity name is required."); return; }
    startTransition(async () => {
      const r = await createLeaveActivity({ name: newActName, description: newActDesc, isSuspendedOnHoliday: newActHoliday, displayOrder: activities.length });
      if (r.success) { setNewActName(""); setNewActDesc(""); setNewActHoliday(false); router.refresh(); }
      else setActError("Failed to create activity.");
    });
  };

  const handleToggleActivity = (id: string, isActive: boolean) => {
    startTransition(async () => { await updateLeaveActivity(id, { isActive }); router.refresh(); });
  };

  const handleDeleteActivity = (id: string) => {
    if (!confirm("Delete this activity? All responses for it will also be deleted.")) return;
    startTransition(async () => { await deleteLeaveActivity(id); router.refresh(); });
  };

  const handleToggleSuspension = (dayId: string, actId: string, isSuspended: boolean) => {
    startTransition(async () => { await toggleActivitySuspension(dayId, actId, !isSuspended); router.refresh(); });
  };

  const handleUpdateDayLabel = (dayId: string, label: string) => {
    startTransition(async () => { await updateDayLabel(dayId, label); router.refresh(); });
  };

  return (
    <div className="space-y-6">
      {/* ── Leave Periods ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-playfair font-semibold text-base">Leave Periods</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage holiday tracking windows. Only one can be active at a time.</p>
        </div>

        {/* List */}
        <div className="divide-y divide-border">
          {periods.map((period) => (
            <div key={period.id}>
              <div className="px-5 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{period.name}</p>
                    {period.isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-foreground text-background px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-jetbrains">
                    {formatDate(period.startDate)} → {formatDate(period.endDate)} · {period.days.length} days
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!period.isActive && (
                    <button
                      onClick={() => handleActivate(period.id)}
                      disabled={isPending}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-all"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedPeriod(expandedPeriod === period.id ? null : period.id)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    title="Configure day suspensions"
                  >
                    <ChevronDown size={14} className={cn("transition-transform", expandedPeriod === period.id && "rotate-180")} />
                  </button>
                  {!period.isActive && (
                    <button
                      onClick={() => handleDeletePeriod(period.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Day suspension editor */}
              {expandedPeriod === period.id && (
                <div className="border-t border-border bg-muted/30 px-5 py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Per-Day Activity Suspension
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Toggle activities to suspend them for specific days. Suspended activities will be shown as greyed-out to parents.
                  </p>
                  <div className="space-y-4">
                    {period.days.map((day) => {
                      const suspendedIds = new Set(day.suspensions.map((s) => s.activityId));
                      return (
                        <div key={day.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-bold">
                              Day {day.dayNumber} — {formatDate(day.date)}
                            </p>
                            {/* Day label editor */}
                            <input
                              defaultValue={day.label ?? ""}
                              placeholder="Label (e.g. Eid Day)"
                              onBlur={(e) => handleUpdateDayLabel(day.id, e.target.value)}
                              className="text-xs px-2 py-0.5 border border-border rounded bg-background outline-none focus:ring-1 focus:ring-foreground/20 w-36"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activities.filter((a) => a.isActive).map((act) => {
                              const suspended = suspendedIds.has(act.id);
                              return (
                                <button
                                  key={act.id}
                                  onClick={() => handleToggleSuspension(day.id, act.id, suspended)}
                                  disabled={isPending}
                                  className={cn(
                                    "text-xs px-2.5 py-1 rounded-full border transition-all",
                                    suspended
                                      ? "bg-red-50 border-red-200 text-red-600 line-through opacity-75"
                                      : "bg-card border-border text-foreground hover:border-foreground/30"
                                  )}
                                >
                                  {suspended ? "✕ " : ""}{act.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          {periods.length === 0 && (
            <div className="px-5 py-6 text-center text-muted-foreground text-sm">No leave periods yet.</div>
          )}
        </div>

        {/* Create form */}
        <div className="px-5 py-4 border-t border-border bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Create New Period</p>
          {periodError && <p className="text-xs text-red-600 mb-2">{periodError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. July Leave 2026)"
              className="col-span-1 sm:col-span-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <button
            onClick={handleCreatePeriod}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> Create Period
          </button>
        </div>
      </div>

      {/* ── Activities ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-playfair font-semibold text-base">Activities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure the daily activities students are tracked on during leave.</p>
        </div>
        <div className="divide-y divide-border">
          {activities.map((act) => (
            <div key={act.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("font-medium text-sm", !act.isActive && "text-muted-foreground line-through")}>
                    {act.name}
                  </p>
                  {!act.isActive && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Disabled</span>
                  )}
                </div>
                {act.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleToggleActivity(act.id, !act.isActive)}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                >
                  {act.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => handleDeleteActivity(act.id)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="px-5 py-6 text-center text-muted-foreground text-sm">No activities yet.</div>
          )}
        </div>
        {/* Create activity */}
        <div className="px-5 py-4 border-t border-border bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add New Activity</p>
          {actError && <p className="text-xs text-red-600 mb-2">{actError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              value={newActName}
              onChange={(e) => setNewActName(e.target.value)}
              placeholder="Activity name (e.g. Tahajjud)"
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <input
              value={newActDesc}
              onChange={(e) => setNewActDesc(e.target.value)}
              placeholder="Description (optional, e.g. Pre-Fajr prayer)"
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newActHoliday}
              onChange={(e) => setNewActHoliday(e.target.checked)}
              className="rounded"
            />
            Suspended by default on holidays
          </label>
          <button
            onClick={handleCreateActivity}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> Add Activity
          </button>
        </div>
      </div>
    </div>
  );
}
