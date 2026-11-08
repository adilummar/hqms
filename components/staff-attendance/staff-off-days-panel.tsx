"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addStaffOffDays,
  deleteStaffOffDay,
  setStaffWeeklyOffDays,
  type OffDaySettings,
} from "@/lib/actions/staff-off-days";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_LABELS: Record<string, string> = {
  holiday: "Holiday",
  students_leave: "Students' leave",
  other: "Other",
};

function fmt(date: string) {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StaffOffDaysPanel({ settings }: { settings: OffDaySettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [weekly, setWeekly] = useState<number[]>(settings.weeklyOffDays);
  const [startDate, setStartDate] = useState(settings.todayDate);
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState<"both" | "FN" | "AN">("both");
  const [type, setType] = useState<"holiday" | "students_leave" | "other">("holiday");
  const [reason, setReason] = useState("");

  function toggleWeekday(d: number) {
    setWeekly((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function saveWeekly() {
    startTransition(async () => {
      const res = await setStaffWeeklyOffDays(weekly);
      if (res.success) {
        toast.success("Weekly off days saved");
        router.refresh();
      } else {
        toast.error("Failed to save weekly off days");
      }
    });
  }

  function addDays(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addStaffOffDays({
        startDate,
        endDate: endDate || startDate,
        scope,
        type,
        reason: reason || null,
      });
      if (res.success) {
        toast.success(
          `Added ${res.added} off day${res.added === 1 ? "" : "s"}` +
            (res.skipped ? ` (${res.skipped} already existed)` : "")
        );
        setReason("");
        setEndDate("");
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Failed to add off days");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteStaffOffDay(id);
      if (res.success) {
        toast.success("Off day removed");
        router.refresh();
      } else {
        toast.error("Failed to remove off day");
      }
    });
  }

  const inputCls =
    "px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans";

  return (
    <div className="bg-card border border-border rounded-xl shadow-2xs print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground font-inter">
          <CalendarOff size={15} className="text-muted-foreground" />
          Off days &amp; holidays
          <span className="text-[11px] font-normal text-muted-foreground font-dm-sans">
            (no attendance expected, no automatic absence)
          </span>
        </span>
        <ChevronDown size={15} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-5">
          {/* Weekly off */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 font-dm-sans">Weekly off days</p>
            <div className="flex flex-wrap items-center gap-2">
              {WEEKDAYS.map((name, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-md border text-xs font-semibold cursor-pointer transition-colors",
                    weekly.includes(d)
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-border bg-background text-muted-foreground hover:border-amber-400"
                  )}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                onClick={saveWeekly}
                disabled={isPending}
                className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold disabled:opacity-60 cursor-pointer"
              >
                Save weekly off
              </button>
            </div>
            {weekly.length === 0 && (
              <p className="text-[11px] text-amber-700 mt-1.5 font-dm-sans">
                No weekly off day is set: every day is treated as a working day.
              </p>
            )}
          </div>

          {/* Add holiday / range */}
          <form onSubmit={addDays} className="space-y-2">
            <p className="text-xs font-semibold text-foreground font-dm-sans">Add a holiday or students&apos; leave</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-muted-foreground font-dm-sans">
                From
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn(inputCls, "block mt-0.5 font-jetbrains")} />
              </label>
              <label className="text-[11px] text-muted-foreground font-dm-sans">
                To (optional)
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={cn(inputCls, "block mt-0.5 font-jetbrains")} />
              </label>
              <label className="text-[11px] text-muted-foreground font-dm-sans">
                Sessions
                <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={cn(inputCls, "block mt-0.5")}>
                  <option value="both">Full day (FN + AN)</option>
                  <option value="FN">FN only</option>
                  <option value="AN">AN only</option>
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground font-dm-sans">
                Type
                <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={cn(inputCls, "block mt-0.5")}>
                  <option value="holiday">Holiday</option>
                  <option value="students_leave">Students&apos; leave</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground font-dm-sans flex-1 min-w-[160px]">
                Reason (optional)
                <input type="text" maxLength={150} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Eid, summer leave" className={cn(inputCls, "block mt-0.5 w-full")} />
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold disabled:opacity-60 cursor-pointer"
              >
                {isPending && <Loader2 size={12} className="animate-spin" />}
                Add
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-dm-sans">
              Existing automatic absences on a date you add are kept; correct them manually if needed.
            </p>
          </form>

          {/* List */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 font-dm-sans">
              Scheduled off days (last 30 days onwards)
            </p>
            {settings.upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground font-dm-sans">None added yet.</p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg max-h-56 overflow-y-auto">
                {settings.upcoming.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-medium text-foreground">{fmt(d.date)}</span>
                    <span className="text-muted-foreground flex-1 truncate">
                      {TYPE_LABELS[d.type] ?? d.type}
                      {d.reason ? ` — ${d.reason}` : ""}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold">
                      {d.scope === "both" ? "FN + AN" : d.scope}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(d.id)}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
