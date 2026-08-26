"use client";

import { useState, useTransition } from "react";
import { updateJuzProgress } from "@/lib/actions/hifz";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type JuzStatus = "not_started" | "in_progress" | "completed";

interface JuzRow {
  juzNumber: number;
  status: JuzStatus;
  startDate: string | null;
  completionDate: string | null;
}

interface JuzDatesEditorProps {
  studentId: string;
  initialRows: JuzRow[];
}

const STATUS_LABELS: Record<JuzStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLORS: Record<JuzStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export function JuzDatesEditor({ studentId, initialRows }: JuzDatesEditorProps) {
  const [rows, setRows] = useState<JuzRow[]>(initialRows);
  const [isPending, startTransition] = useTransition();

  function updateRow(juzNumber: number, field: keyof JuzRow, value: string | JuzStatus | null) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.juzNumber !== juzNumber) return r;
        const updated = { ...r, [field]: value };
        // Auto-clear completion date when reverting from completed
        if (field === "status" && value !== "completed") {
          updated.completionDate = null;
        }
        // Auto-clear start date when reverting to not_started
        if (field === "status" && value === "not_started") {
          updated.startDate = null;
        }
        return updated;
      })
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateJuzProgress({ studentId, juzRows: rows });
      if (result.success) {
        toast.success("Juz dates saved successfully");
      } else {
        toast.error("Failed to save Juz dates");
      }
    });
  }

  const completedCount = rows.filter((r) => r.status === "completed").length;
  const inProgressCount = rows.filter((r) => r.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card border border-border rounded-lg text-sm">
        <span className="text-muted-foreground">
          <span className="font-semibold text-emerald-600">{completedCount}</span> completed
        </span>
        <span className="text-muted-foreground">
          <span className="font-semibold text-amber-600">{inProgressCount}</span> in progress
        </span>
        <span className="text-muted-foreground">
          <span className="font-semibold">{30 - completedCount - inProgressCount}</span> not started
        </span>
        <div className="ml-auto">
          <div className="h-2 w-40 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C9A84C] to-[#e6cc80] rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 30) * 100}%` }}
            />
          </div>
        </div>
        <span className="font-jetbrains text-xs text-muted-foreground">{completedCount}/30</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">Juz</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-44">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Completion Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr
                  key={row.juzNumber}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    row.status === "completed" && "bg-emerald-50/30 dark:bg-emerald-950/10",
                    row.status === "in_progress" && "bg-amber-50/30 dark:bg-amber-950/10"
                  )}
                >
                  {/* Juz Number */}
                  <td className="px-4 py-3">
                    <span className="font-jetbrains font-bold text-base w-8 h-8 flex items-center justify-center rounded-lg bg-muted/50 text-foreground">
                      {row.juzNumber}
                    </span>
                  </td>

                  {/* Status select */}
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateRow(row.juzNumber, "status", e.target.value as JuzStatus)
                      }
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium border-0 outline-none ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary transition-all cursor-pointer",
                        STATUS_COLORS[row.status]
                      )}
                    >
                      {(Object.keys(STATUS_LABELS) as JuzStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Start date */}
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.startDate ?? ""}
                      disabled={row.status === "not_started"}
                      onChange={(e) =>
                        updateRow(row.juzNumber, "startDate", e.target.value || null)
                      }
                      className="font-jetbrains text-xs rounded-md px-2 py-1 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    />
                  </td>

                  {/* Completion date */}
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.completionDate ?? ""}
                      disabled={row.status !== "completed"}
                      onChange={(e) =>
                        updateRow(row.juzNumber, "completionDate", e.target.value || null)
                      }
                      className="font-jetbrains text-xs rounded-md px-2 py-1 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
