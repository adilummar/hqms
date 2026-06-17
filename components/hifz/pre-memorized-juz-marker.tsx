"use client";

import { useState, useTransition } from "react";
import { updateJuzEntry } from "@/lib/actions/students";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, BookOpen, Check } from "lucide-react";

interface Props {
  studentId: string;
  /** Which juz numbers are already completed */
  completedJuzNumbers: number[];
}

export function PreMemorizedJuzMarker({ studentId, completedJuzNumbers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Pre-fill selection with already-completed juz so admin can see current state
  const alreadyDone = new Set(completedJuzNumbers);

  function toggle(num: number) {
    if (alreadyDone.has(num)) return; // can't un-complete via this tool
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  function selectRange(from: number, to: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        if (!alreadyDone.has(i)) next.add(i);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleSave() {
    if (selected.size === 0) {
      toast.error("No juz selected.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    startTransition(async () => {
      // Mark each selected juz as completed with today as both start and completion date
      const results = await Promise.all(
        [...selected].map((juzNumber) =>
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
        toast.success(`${selected.size} Juz marked as pre-memorized!`);
        setSelected(new Set());
        setOpen(false);
        router.refresh();
      } else {
        toast.error(`${failed} juz could not be saved. Please try again.`);
      }
    });
  }

  const allJuz = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={16} className="text-muted-foreground" />
          <div>
            <h3 className="font-playfair text-sm font-semibold">Pre-Memorized Juz</h3>
            <p className="text-xs text-muted-foreground">
              Mark Juz the student memorized before joining this institution
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
          {completedJuzNumbers.length} / 30 done
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 leading-relaxed">
            <strong>How to use:</strong> Select the Juz numbers this student has memorized
            from elsewhere (before joining). They will be marked as{" "}
            <span className="font-semibold">Completed</span> in the Juz tracker.
            Already-completed Juz (gold) cannot be changed here — use the Juz Tracker for that.
          </div>

          {/* Quick range buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Quick select:</span>
            {[
              { label: "Juz 1–5",   from: 1,  to: 5  },
              { label: "Juz 1–10",  from: 1,  to: 10 },
              { label: "Juz 1–15",  from: 1,  to: 15 },
              { label: "Juz 1–20",  from: 1,  to: 20 },
            ].map(({ label, from, to }) => (
              <button
                key={label}
                type="button"
                onClick={() => selectRange(from, to)}
                className="px-2.5 py-1 text-xs border border-border rounded-sm hover:bg-muted transition-colors"
              >
                {label}
              </button>
            ))}
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-sm hover:bg-red-50 transition-colors"
              >
                Clear ({selected.size})
              </button>
            )}
          </div>

          {/* Juz grid */}
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
            {allJuz.map((num) => {
              const isDone     = alreadyDone.has(num);
              const isSelected = selected.has(num);

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => toggle(num)}
                  disabled={isDone}
                  title={
                    isDone
                      ? `Juz ${num} — already completed`
                      : isSelected
                      ? `Juz ${num} — will be marked pre-memorized`
                      : `Juz ${num} — click to select`
                  }
                  className={`
                    relative w-full aspect-square flex items-center justify-center rounded-lg
                    font-jetbrains text-sm font-medium transition-all duration-200
                    ${isDone
                      ? "bg-gradient-to-br from-[#C9A84C] to-[#a3863a] text-white cursor-not-allowed shadow-sm"
                      : isSelected
                      ? "bg-emerald-600 text-white border-2 border-emerald-600 shadow-md scale-105"
                      : "bg-background border border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                    }
                  `}
                >
                  {num}
                  {isDone && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <Check size={9} className="text-[#C9A84C]" strokeWidth={3} />
                    </span>
                  )}
                  {isSelected && !isDone && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                      <Check size={9} className="text-emerald-600" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gradient-to-br from-[#C9A84C] to-[#a3863a] inline-block" />
              Already completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
              Selected (pre-memorized)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-background border border-border inline-block" />
              Not started
            </span>
          </div>

          {/* Save button */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => { setOpen(false); setSelected(new Set()); }}
              className="px-4 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || selected.size === 0}
              className="flex items-center gap-2 px-5 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 size={13} className="animate-spin" />}
              Mark {selected.size > 0 ? `${selected.size} Juz` : ""} as Pre-Memorized
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
