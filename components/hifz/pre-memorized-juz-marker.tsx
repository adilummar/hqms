"use client";

import { useState, useTransition } from "react";
import { updateJuzEntry, resetJuzEntries } from "@/lib/actions/students";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Pencil,
} from "lucide-react";

interface Props {
  studentId: string;
  /** Juz numbers that are fully completed */
  completedJuzNumbers: number[];
  /** Juz numbers that are in-progress (started but not done) */
  inProgressJuzNumbers?: number[];
}

type CellState =
  | "not_started"       // grey — can select to mark pre-memorized
  | "in_progress"       // blue ring — can select to mark pre-memorized or reset
  | "completed"         // gold — can select to reset
  | "pending_add"       // green — will be saved as completed (pre-memorized)
  | "pending_reset";    // red ring — will be reset to not_started

export function PreMemorizedJuzMarker({
  studentId,
  completedJuzNumbers,
  inProgressJuzNumbers = [],
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<Set<number>>(new Set());
  const [pendingReset, setPendingReset] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  const completed = new Set(completedJuzNumbers);
  const inProgress = new Set(inProgressJuzNumbers);

  /* ── Cell click logic ──────────────────────────────────────────────────── */
  function handleCellClick(num: number) {
    if (completed.has(num) || inProgress.has(num)) {
      // Toggle reset selection
      setPendingReset((prev) => {
        const next = new Set(prev);
        if (next.has(num)) next.delete(num);
        else next.add(num);
        return next;
      });
    } else {
      // Toggle add selection
      setPendingAdd((prev) => {
        const next = new Set(prev);
        if (next.has(num)) next.delete(num);
        else next.add(num);
        return next;
      });
    }
  }

  /* ── Quick-select helpers ──────────────────────────────────────────────── */
  function selectRange(from: number, to: number) {
    setPendingAdd((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        if (!completed.has(i) && !inProgress.has(i)) next.add(i);
      }
      return next;
    });
  }

  function clearAll() {
    setPendingAdd(new Set());
    setPendingReset(new Set());
  }

  /* ── Save pre-memorized ────────────────────────────────────────────────── */
  function handleSaveAdd() {
    if (pendingAdd.size === 0) return;
    const today = new Date().toISOString().split("T")[0];

    startTransition(async () => {
      const results = await Promise.all(
        [...pendingAdd].map((juzNumber) =>
          updateJuzEntry({
            studentId,
            juzNumber,
            startDate: today,
            completionDate: today,
            notes: "Pre-memorized before joining",
          })
        )
      );

      const failed = results.filter((r) => !r.success).length;
      if (failed === 0) {
        toast.success(
          `${pendingAdd.size} Juz marked as pre-memorized!`
        );
        setPendingAdd(new Set());
        router.refresh();
      } else {
        toast.error(`${failed} juz could not be saved. Please try again.`);
      }
    });
  }

  /* ── Reset (un-mark) completed juz ────────────────────────────────────── */
  function handleReset() {
    if (pendingReset.size === 0) return;

    startTransition(async () => {
      const result = await resetJuzEntries(studentId, [...pendingReset]);

      if (result.success) {
        toast.success(
          `${pendingReset.size} Juz reset to Not Started.`
        );
        setPendingReset(new Set());
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not reset juz. Please try again.");
      }
    });
  }

  /* ── Cell visual state ─────────────────────────────────────────────────── */
  function getCellState(num: number): CellState {
    if (pendingReset.has(num)) return "pending_reset";
    if (pendingAdd.has(num))   return "pending_add";
    if (completed.has(num))    return "completed";
    if (inProgress.has(num))   return "in_progress";
    return "not_started";
  }

  const totalDone = completedJuzNumbers.length;
  const hasAddPending   = pendingAdd.size > 0;
  const hasResetPending = pendingReset.size > 0;
  const hasAnyPending   = hasAddPending || hasResetPending;

  /* ── Cell style map ────────────────────────────────────────────────────── */
  const cellStyles: Record<CellState, string> = {
    completed:
      "bg-gradient-to-br from-[#C9A84C] to-[#a3863a] text-white shadow-sm shadow-[#C9A84C]/20 cursor-pointer hover:brightness-110",
    in_progress:
      "bg-background border-2 border-blue-400 text-blue-600 cursor-pointer hover:border-red-400 hover:text-red-500",
    not_started:
      "bg-background border border-border text-muted-foreground/50 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50",
    pending_add:
      "bg-emerald-500 text-white border-2 border-emerald-500 shadow-md shadow-emerald-500/25 scale-105 cursor-pointer",
    pending_reset:
      "bg-background border-2 border-red-400 text-red-500 scale-105 cursor-pointer ring-2 ring-red-200",
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* ── Collapsed header ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center">
            <BookOpen size={15} className="text-[#C9A84C]" />
          </div>
          <div>
            <h3 className="font-playfair text-sm font-semibold">
              Memorized Juz Manager
            </h3>
            <p className="text-xs text-muted-foreground">
              Mark or reset Juz the student has memorized
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Progress pill */}
          <span
            className={`text-xs font-jetbrains font-medium px-2.5 py-1 rounded-full ${
              totalDone > 0
                ? "bg-[#C9A84C]/10 text-[#a3863a]"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {totalDone} / 30
          </span>
          {/* Mini progress bar */}
          <div className="hidden sm:flex w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C9A84C] to-[#e6cc80] rounded-full transition-all duration-500"
              style={{ width: `${(totalDone / 30) * 100}%` }}
            />
          </div>
          <Pencil
            size={13}
            className="text-muted-foreground group-hover:text-foreground transition-colors"
          />
          {open ? (
            <ChevronUp size={15} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={15} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {/* ── Expanded panel ───────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4">

          {/* Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800">
              <Check size={12} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>
                <strong>Grey cells</strong> — click to select, then{" "}
                <strong>Mark as Memorized</strong>
              </span>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
              <RotateCcw size={12} className="mt-0.5 shrink-0 text-red-500" />
              <span>
                <strong>Gold cells</strong> — click to select, then{" "}
                <strong>Reset to Not Started</strong>
              </span>
            </div>
          </div>

          {/* Quick-select buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              Quick add:
            </span>
            {[
              { label: "1–5",  from: 1,  to: 5  },
              { label: "1–10", from: 1,  to: 10 },
              { label: "1–15", from: 1,  to: 15 },
              { label: "1–20", from: 1,  to: 20 },
              { label: "1–30", from: 1,  to: 30 },
            ].map(({ label, from, to }) => (
              <button
                key={label}
                type="button"
                onClick={() => selectRange(from, to)}
                className="px-2 py-0.5 text-xs border border-border rounded-sm hover:bg-muted transition-colors font-jetbrains"
              >
                {label}
              </button>
            ))}
            {hasAnyPending && (
              <button
                type="button"
                onClick={clearAll}
                className="px-2 py-0.5 text-xs border border-red-200 text-red-600 rounded-sm hover:bg-red-50 transition-colors"
              >
                Clear ({pendingAdd.size + pendingReset.size})
              </button>
            )}
          </div>

          {/* 30-Juz grid */}
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
              const state = getCellState(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleCellClick(num)}
                  disabled={isPending}
                  title={
                    state === "completed"
                      ? `Juz ${num} — completed · click to reset`
                      : state === "in_progress"
                      ? `Juz ${num} — in progress · click to reset`
                      : state === "pending_add"
                      ? `Juz ${num} — will be marked memorized`
                      : state === "pending_reset"
                      ? `Juz ${num} — will be reset`
                      : `Juz ${num} — click to mark memorized`
                  }
                  className={`
                    relative w-full aspect-square flex items-center justify-center
                    rounded-lg font-jetbrains text-sm font-medium
                    transition-all duration-200 disabled:opacity-60
                    ${cellStyles[state]}
                  `}
                >
                  {num}

                  {/* Completed badge */}
                  {state === "completed" && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <Check size={8} className="text-[#C9A84C]" strokeWidth={3} />
                    </span>
                  )}

                  {/* Pending-add badge */}
                  {state === "pending_add" && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <Check size={8} className="text-emerald-600" strokeWidth={3} />
                    </span>
                  )}

                  {/* Pending-reset badge */}
                  {state === "pending_reset" && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <RotateCcw size={7} className="text-red-500" strokeWidth={3} />
                    </span>
                  )}

                  {/* In-progress dot */}
                  {state === "in_progress" && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-br from-[#C9A84C] to-[#a3863a] inline-block" />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-blue-400 inline-block" />
              In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              To be marked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-red-400 inline-block" />
              To be reset
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-border inline-block" />
              Not started
            </span>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                clearAll();
              }}
              className="px-4 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {/* Reset button — only shown when gold cells are selected */}
              {hasResetPending && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Reset {pendingReset.size} Juz
                </button>
              )}

              {/* Mark memorized button — only shown when grey cells are selected */}
              {hasAddPending && (
                <button
                  type="button"
                  onClick={handleSaveAdd}
                  disabled={isPending}
                  className="flex items-center gap-2 px-5 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Mark {pendingAdd.size} Juz Memorized
                </button>
              )}

              {/* Placeholder when nothing is selected */}
              {!hasAnyPending && (
                <span className="text-xs text-muted-foreground italic">
                  Select juz cells above to take action
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
