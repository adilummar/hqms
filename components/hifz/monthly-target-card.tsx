"use client";

import { setMonthlyTarget } from "@/lib/actions/students";
import { toast } from "sonner";
import Link from "next/link";

interface StudentData {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  target: number;
  actual: number;
}

interface Props {
  student: StudentData;
  year: number;
  month: number;
  studentHref?: string;
}

export function MonthlyTargetCard({ student, year, month, studentHref }: Props) {
  const { id, studentCode, firstName, lastName, target, actual } = student;
  const hasTarget = target > 0;
  const progress = hasTarget ? Math.min(100, (actual / target) * 100) : 0;
  const metTarget = hasTarget && actual >= target;
  const pending = Math.max(0, target - actual);

  async function handleSetTarget(formData: FormData) {
    const newTarget = parseFloat(formData.get("target") as string);
    if (isNaN(newTarget) || newTarget <= 0) {
      toast.error("Please enter a valid target");
      return;
    }
    const result = await setMonthlyTarget({
      studentId: id,
      year,
      month,
      targetJuz: newTarget,
    });
    if (result.success) {
      toast.success("Target updated");
    } else {
      toast.error("Failed to update target");
    }
  }

  async function handleAddTarget(formData: FormData) {
    const additionalTarget = parseFloat(formData.get("additionalTarget") as string);
    if (isNaN(additionalTarget) || additionalTarget <= 0) {
      toast.error("Please enter valid additional Juz");
      return;
    }

    const result = await setMonthlyTarget({
      studentId: id,
      year,
      month,
      targetJuz: target + additionalTarget,
    });

    if (result.success) {
      toast.success("Target increased");
    } else {
      toast.error("Failed to increase target");
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${metTarget ? "border-[#C9A84C] bg-[#C9A84C]/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {metTarget && <span className="text-lg" title="Target Met">⭐</span>}
          <div>
            {studentHref ? (
              <Link
                href={studentHref}
                className="font-medium text-foreground hover:underline text-sm"
              >
                {firstName} {lastName ?? ""}
              </Link>
            ) : (
              <p className="font-medium text-foreground text-sm">
                {firstName} {lastName ?? ""}
              </p>
            )}
            <p className="text-xs text-muted-foreground font-jetbrains">{studentCode}</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <span className="font-jetbrains font-medium text-foreground">{actual}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="font-jetbrains text-muted-foreground">{hasTarget ? target : "—"}</span>
          <span className="text-xs text-muted-foreground ml-1">Juz</span>
        </div>
      </div>

      {/* Progress bar */}
      {hasTarget && (
        <div className="space-y-1.5">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${metTarget ? "bg-[#C9A84C]" : "bg-foreground"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}% complete</span>
            {!metTarget && <span>{pending} Juz remaining</span>}
            {metTarget && <span className="text-[#C9A84C] font-medium">Target met ✓</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <form action={handleSetTarget} className="flex gap-2">
          <input
            type="number"
            name="target"
            step="0.5"
            min="0.5"
            max="30"
            defaultValue={hasTarget ? target : ""}
            placeholder="Target Juz"
            className="flex-1 h-8 px-2 text-xs border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <button
            type="submit"
            className="h-8 px-3 text-xs bg-foreground text-background rounded-sm hover:bg-foreground/90 transition-colors"
          >
            Save
          </button>
        </form>
        <form action={handleAddTarget} className="flex gap-2">
          <input
            type="number"
            name="additionalTarget"
            step="0.5"
            min="0.5"
            max="30"
            placeholder="Add Juz"
            className="flex-1 h-8 px-2 text-xs border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <button
            type="submit"
            className="h-8 px-3 text-xs border border-border rounded-sm hover:bg-muted transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
