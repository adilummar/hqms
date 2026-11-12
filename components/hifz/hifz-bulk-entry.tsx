"use client";

import { useState, useCallback } from "react";
import { saveBulkHifzEntries } from "@/lib/actions/hifz";
import { toast } from "sonner";
import { Save, Loader2, CheckCircle2, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { leavePeriods } from "@/lib/db/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calcSabaqPages, continuationFromPage, validateSabaqRange } from "@/lib/hifz/sabaq-pages";

// ── Types ──────────────────────────────────────────────────────────────────────

type Remark = { id: string; label: string; displayOrder: number | null };

type ExistingEntry = {
  id: string;
  sabaqFromPage: string | null;
  sabaqToPage: string | null;
  sabaqPages: string | null;
  sabaqRemarksId: string | null;
  sabaqJuzGiven: boolean;
  sabaqJuzRemarksId: string | null;
  dauraJuzNumbers: number[] | null;
  dauraRemarksId: string | null;
};

type StudentInput = {
  id: string;
  firstName: string;
  lastName: string | null;
  studentCode: string;
  currentJuzNumber: number | null;
  /** Where this student's previous Sabaq (before the selected date) ended — informational */
  lastSabaqToPage: string | null;
  existingEntry: ExistingEntry | null;
};

type RowState = {
  studentId: string;
  sabaqFromPage: string;
  sabaqToPage: string;
  sabaqPages: string;
  sabaqRemarksId: string;
  sabaqJuzGiven: boolean;
  sabaqJuzRemarksId: string;
  dauraJuz: string;
  dauraRemarksId: string;
};

interface Props {
  date: string;
  students: StudentInput[];
  sabaqRemarks: Remark[];
  sabaqJuzRemarks: Remark[];
  dauraRemarks: Remark[];
  activeLeave?: typeof leavePeriods.$inferSelect | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Inclusive range maths (To − From + 1) is shared with Individual entry and the server
const calcPages = calcSabaqPages;

function parseJuzNumbers(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 30);
}

function hasData(row: RowState): boolean {
  return !!(
    row.sabaqFromPage ||
    row.sabaqToPage ||
    row.dauraJuz ||
    row.sabaqRemarksId ||
    row.dauraRemarksId
  );
}

// ── Shared input / select class strings ───────────────────────────────────────
const inputCls =
  "h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed";
const selectCls =
  "h-8 px-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed";
const labelCls =
  "text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none pt-2 shrink-0";

const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

function DauraJuzSelector({ value, onChange, disabled }: { value: string, onChange: (val: string) => void, disabled?: boolean }) {
  const selected = parseJuzNumbers(value);
  
  const toggleJuz = (juz: number) => {
    if (selected.includes(juz)) {
      onChange(selected.filter((j) => j !== juz).join(" "));
    } else {
      onChange([...selected, juz].sort((a, b) => a - b).join(" "));
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          inputCls,
          "w-full flex items-center justify-between text-left",
          !selected.length && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {selected.length > 0 ? `Juz ${selected.join(", ")}` : "Select Juz"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {JUZ_OPTIONS.map((juz) => (
            <button
              key={juz}
              onClick={() => toggleJuz(juz)}
              className={cn(
                "h-8 text-xs rounded-md border flex items-center justify-center transition-colors",
                selected.includes(juz)
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              {juz}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HifzBulkEntry({
  date,
  students,
  sabaqRemarks,
  sabaqJuzRemarks,
  dauraRemarks,
  activeLeave,
}: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    students.map((s) => ({
      studentId: s.id,
      sabaqFromPage: s.existingEntry?.sabaqFromPage ?? "",
      sabaqToPage: s.existingEntry?.sabaqToPage ?? "",
      sabaqPages: s.existingEntry?.sabaqPages ?? "",
      sabaqRemarksId: s.existingEntry?.sabaqRemarksId ?? "",
      sabaqJuzGiven: s.existingEntry ? s.existingEntry.sabaqJuzGiven : true,
      sabaqJuzRemarksId: s.existingEntry?.sabaqJuzRemarksId ?? "",
      dauraJuz: (s.existingEntry?.dauraJuzNumbers ?? []).join(" "),
      dauraRemarksId: s.existingEntry?.dauraRemarksId ?? "",
    }))
  );

  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(students.filter((s) => s.existingEntry).map((s) => s.id))
  );

  // Common Actions State
  const [bulkSabaqRemark, setBulkSabaqRemark] = useState("");
  const [bulkSabaqJuzRemark, setBulkSabaqJuzRemark] = useState("");
  const [bulkDauraRemark, setBulkDauraRemark] = useState("");
  const [bulkDauraJuz, setBulkDauraJuz] = useState("");

  const applyToAll = () => {
    if (!bulkSabaqRemark && !bulkSabaqJuzRemark && !bulkDauraRemark && !bulkDauraJuz) {
      toast.info("Select a reason or Daura value to apply.");
      return;
    }
    
    setRows((prev) =>
      prev.map((r) => {
        let next = { ...r };
  
        // Sabaq: apply if unmarked
        if (bulkSabaqRemark) {
          const isMarked = parseFloat(next.sabaqPages || "0") > 0 || parseFloat(next.sabaqFromPage || "0") > 0 || parseFloat(next.sabaqToPage || "0") > 0;
          if (!isMarked && !next.sabaqRemarksId) {
            next.sabaqRemarksId = bulkSabaqRemark;
          }
        }
  
        // Sabaq Juz: apply if no reason is currently selected
        if (bulkSabaqJuzRemark) {
          if (!next.sabaqJuzRemarksId) {
            next.sabaqJuzRemarksId = bulkSabaqJuzRemark;
            next.sabaqJuzGiven = false;
          }
        }
  
        // Daura Juz: apply if no daura marks and no reasons exist
        if (bulkDauraJuz) {
          const hasDauraMark = parseJuzNumbers(next.dauraJuz).length > 0;
          if (!hasDauraMark && !next.dauraRemarksId) {
            next.dauraJuz = bulkDauraJuz;
          }
        }
  
        // Daura Reason: apply if no marks exist
        if (bulkDauraRemark) {
          const nextHasDaura = parseJuzNumbers(next.dauraJuz).length > 0;
          if (!nextHasDaura && !next.dauraRemarksId) {
            next.dauraRemarksId = bulkDauraRemark;
          }
        }
  
        return next;
      })
    );
  
    let msg = [];
    if (bulkSabaqRemark) msg.push("Sabaq");
    if (bulkSabaqJuzRemark) msg.push("Sabaq Juz");
    if (bulkDauraJuz || bulkDauraRemark) msg.push("Daura");
    toast.success(`Applied ${msg.join(", ")} to eligible students.`);
  };

  // ── Row update ──────────────────────────────────────────────────────────────
  const updateRow = useCallback(
    (studentId: string, updates: Partial<RowState>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.studentId !== studentId) return r;
          const next = { ...r, ...updates };
          if ("sabaqFromPage" in updates || "sabaqToPage" in updates) {
            next.sabaqPages = calcPages(next.sabaqFromPage, next.sabaqToPage);
          }
          return next;
        })
      );
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    },
    []
  );

  // ── Save All ────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    const toSave = rows.filter((r) => hasData(r));
    if (toSave.length === 0) {
      toast.info("No data entered for any student.");
      return;
    }
    // Same page-range rule as Individual entry; nothing is saved while any row is invalid
    const bad = toSave.find((r) => validateSabaqRange(r.sabaqFromPage, r.sabaqToPage));
    if (bad) {
      const s = students.find((x) => x.id === bad.studentId);
      toast.error(`${s?.firstName ?? "Student"}: ${validateSabaqRange(bad.sabaqFromPage, bad.sabaqToPage)}`);
      return;
    }
    setSaving(true);
    try {
      const entries = toSave.map((r) => ({
        studentId: r.studentId,
        sabaqFromPage: r.sabaqFromPage || undefined,
        sabaqToPage: r.sabaqToPage || undefined,
        sabaqPages: r.sabaqPages || undefined,
        // Same default the Individual form uses: the Juz being memorised (server never overwrites an existing value)
        sabaqJuzNumber: r.sabaqFromPage || r.sabaqToPage ? students.find((s) => s.id === r.studentId)?.currentJuzNumber ?? undefined : undefined,
        sabaqRemarksId: r.sabaqRemarksId || undefined,
        sabaqJuzGiven: r.sabaqJuzGiven,
        sabaqJuzRemarksId: r.sabaqJuzRemarksId || undefined,
        dauraJuzNumbers: parseJuzNumbers(r.dauraJuz),
        dauraRemarksId: r.dauraRemarksId || undefined,
      }));

      const result = await saveBulkHifzEntries({ date, entries });

      if (result.success) {
        toast.success(`Saved ${result.saved} student${result.saved !== 1 ? "s" : ""}`);
        setSavedIds(new Set(toSave.map((r) => r.studentId)));
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Failed to save. Please try again.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (students.length === 0) {
    return (
      <div className="border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
        No students enrolled in this class, or select a class above.
      </div>
    );
  }

  const readyCount = rows.filter((r) => hasData(r)).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="pb-28">

      {/* ── Active leave warning ──────────────────────────────────────────── */}
      {activeLeave && (
        <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">🌙</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              Hifz Tracker paused — Leave period is active
            </p>
            <p className="text-xs text-amber-700 mt-1">
              <span className="font-medium">{activeLeave.name}</span>{" "}
              ({activeLeave.startDate} → {activeLeave.endDate}) is currently active.
              Existing entries are locked and new entries are disabled.
            </p>
          </div>
        </div>
      )}

      {/* ── Common Actions Bar ──────────────────────────────────────────── */}
      {!activeLeave && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Apply to All Students
            </h3>
            <button
              onClick={() => {
                setBulkSabaqRemark("");
                setBulkSabaqJuzRemark("");
                setBulkDauraRemark("");
                setBulkDauraJuz("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset Selection
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_2fr_auto] gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Sabaq</label>
              <select
                value={bulkSabaqRemark}
                onChange={(e) => setBulkSabaqRemark(e.target.value)}
                className={cn(selectCls, "w-full")}
              >
                <option value="">Select Reason…</option>
                {sabaqRemarks.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Sabaq Juz</label>
              <select
                value={bulkSabaqJuzRemark}
                onChange={(e) => setBulkSabaqJuzRemark(e.target.value)}
                className={cn(selectCls, "w-full")}
              >
                <option value="">Select Reason…</option>
                {sabaqJuzRemarks.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Daura Juz</label>
                <DauraJuzSelector value={bulkDauraJuz} onChange={setBulkDauraJuz} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Daura Reason</label>
                <select
                  value={bulkDauraRemark}
                  onChange={(e) => setBulkDauraRemark(e.target.value)}
                  className={cn(selectCls, "w-full")}
                >
                  <option value="">Select Reason…</option>
                  {dauraRemarks.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-full lg:w-auto">
              <button
                onClick={applyToAll}
                className="w-full lg:w-auto h-8 px-5 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors whitespace-nowrap"
              >
                Apply to All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{savedIds.size}</span>
          /{students.length} saved
          {readyCount > savedIds.size && (
            <span className="ml-2 text-amber-600 font-semibold">
              · {readyCount - savedIds.size} unsaved
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Sabaq Juz <span className="font-semibold text-foreground">✓</span> checked by default — uncheck if not given
        </p>
      </div>

      {/* ── Student cards ─────────────────────────────────────────────────── */}
      <fieldset disabled={!!activeLeave} className="space-y-3">
        {students.map((student, i) => {
          const row = rows[i];
          const isSaved = savedIds.has(student.id);
          const touched = hasData(row);
          
          // Compute disable logic
          const sabaqMarkGiven = parseFloat(row.sabaqPages || "0") > 0 || parseFloat(row.sabaqFromPage || "0") > 0 || parseFloat(row.sabaqToPage || "0") > 0;
          const sabaqJuzMarkGiven = row.sabaqJuzGiven;
          const dauraMarkGiven = parseJuzNumbers(row.dauraJuz).length > 0;
          const rangeErr = validateSabaqRange(row.sabaqFromPage, row.sabaqToPage);
          // Individual entry shows the indicator only when there is no entry yet for the date
          const suggestedFrom =
            !student.existingEntry && student.lastSabaqToPage ? continuationFromPage(student.lastSabaqToPage) : undefined;

          return (
            <div
              key={student.id}
              className={cn(
                "bg-card border rounded-xl transition-all duration-200 overflow-hidden",
                isSaved
                  ? "border-emerald-200 bg-emerald-50/20"
                  : touched
                  ? "border-foreground/20 shadow-sm"
                  : "border-border"
              )}
            >
              {/* ── Student header ────────────────────────────────────────── */}
              <div className={cn(
                "flex items-center justify-between px-4 py-3 border-b",
                isSaved ? "border-emerald-100 bg-emerald-50/40" : "border-border bg-muted/20"
              )}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.07] border border-border flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                    {student.firstName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">
                      {student.firstName} {student.lastName ?? ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-jetbrains mt-0.5">
                      {student.studentCode}
                      {student.currentJuzNumber != null &&
                        ` · Juz ${student.currentJuzNumber}`}
                    </p>
                  </div>
                </div>

                {isSaved ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                    <CheckCircle2 size={10} /> Saved
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">
                    Pending
                  </span>
                )}
              </div>

              {/* ── Entry fields ──────────────────────────────────────────── */}
              <div className="px-4 py-3 space-y-2.5">

                {/* Sabaq row */}
                <div className="grid grid-cols-[3rem_1fr] gap-x-3 items-start">
                  <span className={labelCls}>Sabaq</span>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder={suggestedFrom ? `From pg (${suggestedFrom})` : "From pg"}
                      aria-invalid={!!rangeErr}
                      value={row.sabaqFromPage}
                      onChange={(e) =>
                        updateRow(student.id, { sabaqFromPage: e.target.value })
                      }
                      className={cn(inputCls, "w-[78px]")}
                    />
                    <span className="text-muted-foreground text-xs font-medium">→</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="To pg"
                      value={row.sabaqToPage}
                      onChange={(e) =>
                        updateRow(student.id, { sabaqToPage: e.target.value })
                      }
                      className={cn(inputCls, "w-[78px]")}
                    />
                    {row.sabaqPages && (
                      <span className="text-xs font-semibold text-foreground bg-muted border border-border px-2 py-1 rounded-lg tabular-nums">
                        {row.sabaqPages} pg
                      </span>
                    )}
                    {/* Same indicator + rule as Individual entry: shown only for a new entry that has a previous Sabaq. Informational — never fills the field. */}
                    {suggestedFrom && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        ↩ continued from pg {student.lastSabaqToPage}
                      </span>
                    )}
                    {rangeErr && <span className="basis-full text-[11px] text-destructive">{rangeErr}</span>}
                    {sabaqRemarks.length > 0 && (
                      <select
                        disabled={sabaqMarkGiven}
                        value={row.sabaqRemarksId}
                        onChange={(e) =>
                          updateRow(student.id, { sabaqRemarksId: e.target.value })
                        }
                        className={cn(selectCls, "min-w-[110px]")}
                      >
                        <option value="">Remark…</option>
                        {sabaqRemarks.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border/50" />

                {/* Sabaq Juz row */}
                <div className="grid grid-cols-[3rem_1fr] gap-x-3 items-start">
                  <span className={labelCls}>SJ</span>
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={row.sabaqJuzGiven}
                        onChange={(e) =>
                          updateRow(student.id, { sabaqJuzGiven: e.target.checked })
                        }
                        className="accent-foreground w-4 h-4 rounded"
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          row.sabaqJuzGiven ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        Given
                      </span>
                    </label>
                    {sabaqJuzRemarks.length > 0 && (
                      <select
                        disabled={sabaqJuzMarkGiven}
                        value={row.sabaqJuzRemarksId}
                        onChange={(e) =>
                          updateRow(student.id, { sabaqJuzRemarksId: e.target.value })
                        }
                        className={cn(selectCls, "min-w-[110px]")}
                      >
                        <option value="">Remark…</option>
                        {sabaqJuzRemarks.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border/50" />

                {/* Daura row */}
                <div className="grid grid-cols-[3rem_1fr] gap-x-3 items-start">
                  <span className={labelCls}>Daura</span>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="min-w-[140px] max-w-[200px]">
                      <DauraJuzSelector 
                        value={row.dauraJuz} 
                        onChange={(v) => updateRow(student.id, { dauraJuz: v })} 
                      />
                    </div>
                    {dauraRemarks.length > 0 && (
                      <select
                        disabled={dauraMarkGiven}
                        value={row.dauraRemarksId}
                        onChange={(e) =>
                          updateRow(student.id, { dauraRemarksId: e.target.value })
                        }
                        className={cn(selectCls, "min-w-[110px]")}
                      >
                        <option value="">Remark…</option>
                        {dauraRemarks.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </fieldset>

      {/* ── Fixed Save All button ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-16 lg:left-64 z-40 pointer-events-none">
        <div className="px-4 pb-5 pt-10 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-auto">
          <button
            onClick={handleSaveAll}
            disabled={saving || readyCount === 0}
            className={cn(
              "w-full max-w-3xl mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg",
              saving || readyCount === 0
                ? "bg-foreground/40 text-background cursor-not-allowed"
                : "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
            )}
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {saving
              ? "Saving…"
              : !!activeLeave
              ? "Inputs Locked — Leave Active"
              : readyCount > 0
              ? `Save All — ${readyCount} student${readyCount !== 1 ? "s" : ""}`
              : "Enter data above to save"}
          </button>
        </div>
      </div>
    </div>
  );
}
