"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDailyHifzEntry } from "@/lib/actions/hifz";
import { toast } from "sonner";
import { Loader2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { hifzDailyEntries, juzTracker, leavePeriods } from "@/lib/db/schema";

interface Remark {
  id: string;
  label: string;
}

interface Props {
  studentId: string;
  date: string;
  existingEntry?: typeof hifzDailyEntries.$inferSelect;
  activeJuz?: typeof juzTracker.$inferSelect;
  sabaqRemarks: Remark[];
  sabaqJuzRemarks: Remark[];
  dauraRemarks: Remark[];
  /** Hafiz mode: Daura-only, two sessions per day (no Sabaq / Sabaq Juz). */
  isHafiz?: boolean;
  /** sabaqToPage from the most recent prior entry — used to suggest today's From Page. */
  lastSabaqToPage?: string;
  activeLeave?: typeof leavePeriods.$inferSelect | null;
}

/** One Daura session block — a 30-Juz checkbox grid plus a reason dropdown. */
function DauraBlock({
  title,
  juzName,
  remarksName,
  defaultJuz,
  defaultRemarksId,
  remarks,
}: {
  title: string;
  juzName: string;
  remarksName: string;
  defaultJuz?: number[] | null;
  defaultRemarksId?: string | null;
  remarks: Remark[];
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="font-playfair text-lg font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs text-muted-foreground mb-2">Select Juz Numbers (Multiple allowed)</label>
          <div className="h-40 overflow-y-auto border border-border rounded-sm p-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-6 gap-2 bg-background">
            {Array.from({ length: 30 }).map((_, i) => (
              <label key={i + 1} className="flex items-center justify-center cursor-pointer group">
                <input
                  type="checkbox"
                  name={juzName}
                  value={i + 1}
                  defaultChecked={defaultJuz?.includes(i + 1)}
                  className="peer sr-only"
                />
                <span className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs font-medium text-muted-foreground group-hover:border-primary/50 peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary transition-colors">
                  {i + 1}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Or Select Reason</label>
          <select name={remarksName} defaultValue={defaultRemarksId ?? ""}
            className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-background">
            <option value="">-- No Reason --</option>
            {remarks.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function calculateSabaqPages(fromValue: string, toValue: string) {
  if (!fromValue || !toValue) return "";

  const from = parseFloat(fromValue);
  const to = parseFloat(toValue);
  return !Number.isNaN(from) && !Number.isNaN(to) && to >= from
    ? (to - from + 1).toString()
    : "";
}

export function HifzEntryForm({ studentId, date, existingEntry, activeJuz, sabaqRemarks, sabaqJuzRemarks, dauraRemarks, isHafiz = false, lastSabaqToPage, activeLeave }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  // Navigate to a different date — triggers full server re-render
  function navigateToDate(newDate: string) {
    if (!newDate || newDate === date) return;
    startNavTransition(() => {
      router.push(`/tutor/hifz/entry/${studentId}?date=${newDate}`);
    });
  }

  // Step one day forward / backward
  function stepDate(direction: 1 | -1) {
    const d = new Date(date);
    d.setDate(d.getDate() + direction);
    const next = d.toISOString().split("T")[0];
    if (next <= today) navigateToDate(next);
  }

  // From Page suggestion logic:
  // - If last toPage is a half-page (e.g. 14.5) → student wasn't done with that page → start from SAME page (14.5)
  // - If last toPage is a whole page (e.g. 14) → student finished that page → start from NEXT page (15)
  const suggestedFromPage = !existingEntry && lastSabaqToPage
    ? (() => {
        const last = parseFloat(lastSabaqToPage);
        return (last % 1 === 0 ? last + 1 : last).toString();
      })()
    : undefined;

  const [sabaqFromPage, setSabaqFromPage] = useState(existingEntry?.sabaqFromPage?.toString() ?? suggestedFromPage ?? "");
  const [sabaqToPage, setSabaqToPage] = useState(existingEntry?.sabaqToPage?.toString() ?? "");
  const [sabaqPages, setSabaqPages] = useState(existingEntry?.sabaqPages?.toString() ?? "");
  const [sabaqJuzGiven, setSabaqJuzGiven] = useState<boolean | undefined>(existingEntry?.sabaqJuzGiven ?? undefined);

  const hasSabaq = !!sabaqFromPage || !!sabaqToPage || !!sabaqPages;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      id: existingEntry?.id,
      studentId,
      date,
      sabaqFromPage: formData.get("sabaqFromPage") as string || undefined,
      sabaqToPage: formData.get("sabaqToPage") as string || undefined,
      sabaqPages: formData.get("sabaqPages") as string || undefined,
      sabaqJuzNumber: formData.get("sabaqJuzNumber") ? Number(formData.get("sabaqJuzNumber")) : undefined,
      sabaqRemarksId: formData.get("sabaqRemarksId") as string || undefined,
      
      sabaqJuzGiven: formData.get("sabaqJuzGiven") === "true",
      sabaqJuzRemarksId: formData.get("sabaqJuzRemarksId") as string || undefined,
      
      dauraJuzNumbers: formData.getAll("dauraJuzNumbers").map(Number).filter(Boolean),
      dauraRemarksId: formData.get("dauraRemarksId") as string || undefined,

      daura2JuzNumbers: formData.getAll("daura2JuzNumbers").map(Number).filter(Boolean),
      daura2RemarksId: formData.get("daura2RemarksId") as string || undefined,

      notes: formData.get("notes") as string || undefined,

      startJuzNumber: formData.get("startJuzNumber") ? Number(formData.get("startJuzNumber")) : undefined,
      startJuzDate: formData.get("startJuzDate") as string || undefined,
      
      completeJuzId: formData.get("completeJuzId") as string || undefined,
      completeJuzDate: formData.get("completeJuzDate") as string || undefined,
    };

    startTransition(async () => {
      const res = await saveDailyHifzEntry(data);
      if (res.success) {
        toast.success("Hifz entry saved successfully");
        router.push("/tutor/hifz");
      } else {
        toast.error(res.error || "Failed to save entry");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {activeLeave && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-5 py-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">🌙</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              Hifz Tracker paused — Leave period is active
            </p>
            <p className="text-xs text-amber-700 mt-1">
              <span className="font-medium">{activeLeave.name}</span> ({activeLeave.startDate} → {activeLeave.endDate}) is currently active.
              Existing entries are locked and new entries are disabled.
            </p>
          </div>
        </div>
      )}

      {/* ── Date Navigator ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays size={16} />
          <span className="text-xs font-medium uppercase tracking-wide">Entry Date</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepDate(-1)}
            disabled={isNavigating}
            className="h-8 w-8 flex items-center justify-center rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-40"
            title="Previous day"
          >
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            disabled={isNavigating}
            onChange={(e) => navigateToDate(e.target.value)}
            className="h-8 px-3 text-sm font-medium border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => stepDate(1)}
            disabled={isNavigating || date >= today}
            className="h-8 w-8 flex items-center justify-center rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-40"
            title="Next day"
          >
            <ChevronRight size={14} />
          </button>
          {isNavigating && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {existingEntry ? (
            <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">✓ Entry exists</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-medium">⊘ No entry yet</span>
          )}
        </div>
      </div>

      <fieldset disabled={!!activeLeave} className="space-y-6">
      {isHafiz && (
        <div className="bg-card border border-border rounded-lg p-5 border-l-4 border-l-emerald-500">
          <p className="text-sm font-medium">🎓 Hafiz mode — Daura only, two sessions per day. Sabaq &amp; Sabaq Juz are not applicable.</p>
        </div>
      )}

      {!isHafiz && (
      <>
      {/* Juz Tracking Section */}
      <div className="bg-card border border-border rounded-lg p-5 border-l-4 border-l-primary">
        <h2 className="font-playfair text-lg font-semibold mb-4">Juz Progress Tracking</h2>
        
        {activeJuz ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-md border border-border">
              <div>
                <p className="text-sm font-medium">Currently Memorizing: <span className="font-bold text-base">Juz {activeJuz.juzNumber}</span></p>
                <p className="text-xs text-muted-foreground mt-1">Started on {activeJuz.startDate}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 items-center mt-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="completeJuzId" value={activeJuz.id} className="accent-primary w-4 h-4" />
                  Mark Juz {activeJuz.juzNumber} as Completed Today ({date})
                </label>
                {/* Completion date = the entry date — no separate picker needed */}
                <input type="hidden" name="completeJuzDate" value={date} />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Start New Juz Number</label>
              <input name="startJuzNumber" type="number" min="1" max="30" placeholder="e.g. 1"
                className="w-48 h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-background" />
              {/* Start date = the entry date — no separate picker needed */}
              <input type="hidden" name="startJuzDate" value={date} />
              <p className="text-xs text-muted-foreground mt-1.5">Will be recorded as starting on <span className="font-medium">{date}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Sabaq */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-playfair text-lg font-semibold mb-4">Sabaq (New Lesson)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 items-end">
          <div className="flex flex-col justify-end">
            <label className="block text-xs text-muted-foreground mb-1">
              From Page
              {suggestedFromPage && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                  ↩ continued from pg {lastSabaqToPage}
                </span>
              )}
            </label>
            <input name="sabaqFromPage" type="number" step="0.5" value={sabaqFromPage} onChange={(e) => {
              const nextFrom = e.target.value;
              setSabaqFromPage(nextFrom);
              setSabaqPages(calculateSabaqPages(nextFrom, sabaqToPage));
            }}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="flex flex-col justify-end">
            <label className="block text-xs text-muted-foreground mb-1">To Page</label>
            <input name="sabaqToPage" type="number" step="0.5" value={sabaqToPage} onChange={(e) => {
              const nextTo = e.target.value;
              setSabaqToPage(nextTo);
              setSabaqPages(calculateSabaqPages(sabaqFromPage, nextTo));
            }}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="flex flex-col justify-end">
            <label className="block text-xs text-muted-foreground mb-1">Total Pages</label>
            <input name="sabaqPages" type="number" step="0.5" value={sabaqPages} onChange={(e) => setSabaqPages(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="flex flex-col justify-end">
            <label className="block text-xs text-muted-foreground mb-1">Juz</label>
            <input
              name="sabaqJuzNumber"
              type="number"
              min="1"
              max="30"
              placeholder={activeJuz ? String(activeJuz.juzNumber) : "1–30"}
              key={`juz-${existingEntry?.id ?? "new"}-${activeJuz?.juzNumber ?? 0}`}
              defaultValue={
                existingEntry?.sabaqJuzNumber != null
                  ? Number(existingEntry.sabaqJuzNumber)
                  : activeJuz?.juzNumber ?? undefined
              }
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Or Select Reason (if no Sabaq)</label>
          <select name="sabaqRemarksId" defaultValue={existingEntry?.sabaqRemarksId ?? ""} disabled={hasSabaq}
            className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-background disabled:opacity-50 disabled:bg-muted">
            <option value="">-- No Reason --</option>
            {sabaqRemarks.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Sabaq Juz */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-playfair text-lg font-semibold mb-4">Sabaq Juz (Recent Revision)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <div className="flex gap-4 items-center h-9">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="radio" 
                  name="sabaqJuzGiven" 
                  value="true" 
                  checked={sabaqJuzGiven === true}
                  onChange={() => setSabaqJuzGiven(true)}
                  className="accent-primary" 
                />
                Given
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="radio" 
                  name="sabaqJuzGiven" 
                  value="false" 
                  checked={sabaqJuzGiven === false}
                  onChange={() => setSabaqJuzGiven(false)}
                  className="accent-primary" 
                />
                Not Given
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Or Select Reason</label>
            <select name="sabaqJuzRemarksId" defaultValue={existingEntry?.sabaqJuzRemarksId ?? ""}
              disabled={sabaqJuzGiven === true}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-background disabled:opacity-50 disabled:bg-muted">
              <option value="">-- No Reason --</option>
              {sabaqJuzRemarks.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      </>
      )}

      {/* Daura — session 1 (both modes). In Hafiz mode a second session follows. */}
      <DauraBlock
        title={isHafiz ? "Daura 1 (Old Revision)" : "Daura (Old Revision)"}
        juzName="dauraJuzNumbers"
        remarksName="dauraRemarksId"
        defaultJuz={existingEntry?.dauraJuzNumbers}
        defaultRemarksId={existingEntry?.dauraRemarksId}
        remarks={dauraRemarks}
      />

      {isHafiz && (
        <DauraBlock
          title="Daura 2 (Old Revision)"
          juzName="daura2JuzNumbers"
          remarksName="daura2RemarksId"
          defaultJuz={existingEntry?.daura2JuzNumbers}
          defaultRemarksId={existingEntry?.daura2RemarksId}
          remarks={dauraRemarks}
        />
      )}

      {/* General Notes */}
      <div className="bg-card border border-border rounded-lg p-5">
        <label className="block text-xs font-semibold text-foreground mb-2">Tutor Notes (Optional)</label>
        <textarea name="notes" rows={3} defaultValue={existingEntry?.notes ?? ""}
          className="w-full px-3 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          placeholder="Any specific observations about today's progress..." />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {existingEntry ? "Update Entry" : "Save Entry"}
        </button>
      </div>
      </fieldset>
    </form>
  );
}
