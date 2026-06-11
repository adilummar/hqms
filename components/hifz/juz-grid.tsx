"use client";

import { cn } from "@/lib/utils";

interface JuzCell {
  juzNumber: number;
  status: "not_started" | "in_progress" | "completed";
  startDate?: string | null;
  completionDate?: string | null;
}

interface JuzGridProps {
  juzData: JuzCell[];
  onCellClick?: (juzNumber: number) => void;
  readonly?: boolean;
}

import { Check } from "lucide-react";

export function JuzGrid({ juzData, onCellClick, readonly = false }: JuzGridProps) {
  const completed = juzData.filter((j) => j.status === "completed").length;
  const inProgress = juzData.filter((j) => j.status === "in_progress").length;

  const juzMap = new Map(juzData.map((j) => [j.juzNumber, j]));

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 sm:gap-4 relative p-5 bg-gradient-to-b from-muted/30 to-background rounded-2xl border border-border/50 shadow-sm">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
          const juz = juzMap.get(num);
          const status = juz?.status ?? "not_started";

          return (
            <button
              key={num}
              type="button"
              onClick={() => !readonly && onCellClick?.(num)}
              disabled={readonly}
              title={
                juz?.completionDate
                  ? `Completed: ${juz.completionDate}`
                  : juz?.startDate
                  ? `Started: ${juz.startDate}`
                  : `Juz ${num}`
              }
              className={cn(
                "relative w-full aspect-square flex flex-col items-center justify-center font-jetbrains font-medium rounded-xl transition-all duration-300",
                status === "completed" &&
                  "bg-gradient-to-br from-[#C9A84C] to-[#a3863a] text-white shadow-lg shadow-[#C9A84C]/25 border border-[#C9A84C]/30 scale-105 z-10",
                status === "in_progress" &&
                  "bg-background border-2 border-[#C9A84C] text-[#C9A84C] shadow-[0_0_20px_rgba(201,168,76,0.3)] animate-pulse",
                status === "not_started" &&
                  "bg-background/50 border border-border/60 text-muted-foreground/40",
                !readonly &&
                  status !== "completed" &&
                  "hover:border-[#C9A84C] hover:text-[#C9A84C] hover:shadow-md cursor-pointer hover:-translate-y-1 hover:scale-105 hover:bg-background z-20",
                readonly && "cursor-default"
              )}
            >
              <span className={cn("text-lg font-bold", status === "not_started" && "font-normal")}>{num}</span>
              
              {status === "completed" && (
                <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center shadow-sm">
                  <Check strokeWidth={3} className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm bg-muted/20 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2 text-muted-foreground font-medium">
            <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#a3863a] shadow-sm shadow-[#C9A84C]/30" />
            <span>{completed} completed</span>
          </span>
          {inProgress > 0 && (
            <span className="flex items-center gap-2 text-muted-foreground font-medium">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#C9A84C] animate-pulse" />
              <span>{inProgress} in progress</span>
            </span>
          )}
        </div>
        <span className="font-jetbrains text-muted-foreground font-medium bg-background px-3 py-1 rounded-md border border-border shadow-sm">
          {completed} / 30 Juz
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden border border-border/50 p-0.5 shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-[#C9A84C] to-[#e6cc80] rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${(completed / 30) * 100}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
