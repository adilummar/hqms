"use client";

import { useState, useCallback } from "react";
import { saveBulkHifzEntries } from "@/lib/actions/hifz";
import { toast } from "sonner";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  dauraJuz: string; // space or comma-separated numbers e.g. "2 15"
  dauraRemarksId: string;
};

interface Props {
  date: string;
  students: StudentInput[];
  sabaqRemarks: Remark[];
  sabaqJuzRemarks: Remark[];
  dauraRemarks: Remark[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcPages(from: string, to: string): string {
  const f = parseFloat(from);
  const t = parseFloat(to);
  if (isNaN(f) || isNaN(t) || t < f) return "";
  const diff = Math.round((t - f) * 10) / 10;
  return diff.toString();
}

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

// ── Component ──────────────────────────────────────────────────────────────────

export function HifzBulkEntry({
  date,
  students,
  sabaqRemarks,
  sabaqJuzRemarks,
  dauraRemarks,
}: Props) {
  // Initialise row state from existing entries (or defaults)
  const [rows, setRows] = useState<RowState[]>(() =>
    students.map((s) => ({
      studentId: s.id,
      sabaqFromPage: s.existingEntry?.sabaqFromPage ?? "",
      sabaqToPage: s.existingEntry?.sabaqToPage ?? "",
      sabaqPages: s.existingEntry?.sabaqPages ?? "",
      sabaqRemarksId: s.existingEntry?.sabaqRemarksId ?? "",
      // Default sabaqJuzGiven = true for new entries, use existing value otherwise
      sabaqJuzGiven: s.existingEntry ? s.existingEntry.sabaqJuzGiven : true,
      sabaqJuzRemarksId: s.existingEntry?.sabaqJuzRemarksId ?? "",
      dauraJuz: (s.existingEntry?.dauraJuzNumbers ?? []).join(" "),
      dauraRemarksId: s.existingEntry?.dauraRemarksId ?? "",
    }))
  );

  const [saving, setSaving] = useState(false);
  // Track which students already have a saved entry
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(students.filter((s) => s.existingEntry).map((s) => s.id))
  );

  // ── Row update ──────────────────────────────────────────────────────────────

  const updateRow = useCallback(
    (studentId: string, updates: Partial<RowState>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.studentId !== studentId) return r;
          const next = { ...r, ...updates };
          // Auto-recalculate pages whenever from/to change
          if ("sabaqFromPage" in updates || "sabaqToPage" in updates) {
            next.sabaqPages = calcPages(next.sabaqFromPage, next.sabaqToPage);
          }
          return next;
        })
      );
      // Mark row as unsaved when edited
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

    setSaving(true);
    try {
      const entries = toSave.map((r) => ({
        studentId: r.studentId,
        sabaqFromPage: r.sabaqFromPage || undefined,
        sabaqToPage: r.sabaqToPage || undefined,
        sabaqPages: r.sabaqPages || undefined,
        sabaqRemarksId: r.sabaqRemarksId || undefined,
        sabaqJuzGiven: r.sabaqJuzGiven,
        sabaqJuzRemarksId: r.sabaqJuzRemarksId || undefined,
        dauraJuzNumbers: parseJuzNumbers(r.dauraJuz),
        dauraRemarksId: r.dauraRemarksId || undefined,
      }));

      const result = await saveBulkHifzEntries({ date, entries });

      if (result.success) {
        toast.success(
          `Saved ${result.saved} student${result.saved !== 1 ? "s" : ""}`
        );
        setSavedIds(new Set(toSave.map((r) => r.studentId)));
      } else {
        toast.error("Failed to save. Please try again.");
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
      <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
        No students enrolled in this class, or select a class above.
      </div>
    );
  }

  const readyCount = rows.filter((r) => hasData(r)).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 pb-28">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{savedIds.size}</span>/{students.length} saved
          {readyCount > savedIds.size && (
            <span className="ml-2 text-amber-600 font-medium">
              · {readyCount - savedIds.size} unsaved
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Sabaq Juz <span className="font-medium text-foreground">✓</span> = checked by default — uncheck per student if not given
        </p>
      </div>

      {/* Column hint for small screens */}
      <p className="text-xs text-muted-foreground sm:hidden px-1">
        Sabaq Juz is checked ✓ by default — uncheck if not given
      </p>

      {/* Student cards */}
      {students.map((student, i) => {
        const row = rows[i];
        const isSaved = savedIds.has(student.id);
        const touched = hasData(row);

        return (
          <div
            key={student.id}
            className={cn(
              "bg-card border rounded-xl p-4 transition-all duration-200",
              isSaved
                ? "border-green-200 bg-green-50/30"
                : touched
                ? "border-foreground/25 shadow-sm"
                : "border-border"
            )}
          >
            {/* ── Student header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-foreground/[0.06] border border-border flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                  {student.firstName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">
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
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={10} /> Saved
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Pending
                </span>
              )}
            </div>

            {/* ── Sabaq row ──────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 items-center mb-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest w-14 shrink-0">
                Sabaq
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="From pg"
                value={row.sabaqFromPage}
                onChange={(e) =>
                  updateRow(student.id, { sabaqFromPage: e.target.value })
                }
                className="w-[74px] h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="To pg"
                value={row.sabaqToPage}
                onChange={(e) =>
                  updateRow(student.id, { sabaqToPage: e.target.value })
                }
                className="w-[74px] h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
              />
              {row.sabaqPages && (
                <span className="text-xs font-medium text-foreground bg-muted px-2 py-1 rounded-lg tabular-nums">
                  {row.sabaqPages} pg
                </span>
              )}
              {sabaqRemarks.length > 0 && (
                <select
                  value={row.sabaqRemarksId}
                  onChange={(e) =>
                    updateRow(student.id, { sabaqRemarksId: e.target.value })
                  }
                  className="h-8 px-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground text-muted-foreground"
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

            {/* ── Sabaq Juz + Daura row ──────────────────────────────── */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Sabaq Juz */}
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest w-14 shrink-0">
                SJ
              </span>
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
                  value={row.sabaqJuzRemarksId}
                  onChange={(e) =>
                    updateRow(student.id, { sabaqJuzRemarksId: e.target.value })
                  }
                  className="h-8 px-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground text-muted-foreground"
                >
                  <option value="">Remark…</option>
                  {sabaqJuzRemarks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Daura */}
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ml-1 shrink-0">
                Daura
              </span>
              <input
                type="text"
                placeholder="Juz e.g. 2 15"
                value={row.dauraJuz}
                onChange={(e) =>
                  updateRow(student.id, { dauraJuz: e.target.value })
                }
                className="w-28 h-8 px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
              />
              {dauraRemarks.length > 0 && (
                <select
                  value={row.dauraRemarksId}
                  onChange={(e) =>
                    updateRow(student.id, { dauraRemarksId: e.target.value })
                  }
                  className="h-8 px-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground text-muted-foreground"
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
        );
      })}

      {/* ── Fixed Save All button ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-16 lg:left-64 z-40 pointer-events-none">
        <div className="px-4 pb-5 pt-8 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-auto">
          <button
            onClick={handleSaveAll}
            disabled={saving || readyCount === 0}
            className={cn(
              "w-full max-w-2xl mx-auto flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-md",
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
              : readyCount > 0
              ? `Save All — ${readyCount} student${readyCount !== 1 ? "s" : ""}`
              : "Enter data above to save"}
          </button>
        </div>
      </div>
    </div>
  );
}
