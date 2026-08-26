"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertToHafiz, revertFromHafiz } from "@/lib/actions/hifz";
import { toast } from "sonner";
import { Loader2, GraduationCap } from "lucide-react";

interface Props {
  studentId: string;
  isHafiz: boolean;
  completedJuzCount: number;
  /** Only admins/super-admins may revert a Hafiz back to normal mode. */
  canRevert: boolean;
}

export function HafizModeToggle({ studentId, isHafiz, completedJuzCount, canRevert }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const eligible = completedJuzCount >= 30;

  function handleConvert() {
    startTransition(async () => {
      const res = await convertToHafiz(studentId);
      if (res.success) {
        toast.success("Student converted to Hafiz mode 🎓");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to convert");
      }
    });
  }

  function handleRevert() {
    if (!confirm("Revert this student out of Hafiz mode? Their daily entry will return to the full Sabaq / Sabaq Juz / Daura form.")) return;
    startTransition(async () => {
      const res = await revertFromHafiz(studentId);
      if (res.success) {
        toast.success("Reverted to normal mode");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to revert");
      }
    });
  }

  if (isHafiz) {
    return (
      <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
          <GraduationCap size={18} />
          Hafiz — Daura only (two sessions/day)
        </span>
        {canRevert && (
          <button
            type="button"
            onClick={handleRevert}
            disabled={isPending}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-300 text-emerald-800 text-xs font-medium rounded-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Revert to normal mode
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div>
        <p className="text-sm font-medium">Hafiz mode</p>
        <p className="text-xs text-muted-foreground">
          {eligible
            ? "All 30 Juz completed — this student can be converted to Hafiz mode."
            : `${completedJuzCount}/30 Juz completed. Convert once all 30 are done.`}
        </p>
      </div>
      <button
        type="button"
        onClick={handleConvert}
        disabled={!eligible || isPending}
        title={eligible ? undefined : "Complete all 30 Juz first"}
        className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && <Loader2 size={12} className="animate-spin" />}
        <GraduationCap size={14} />
        Convert to Hafiz Mode
      </button>
    </div>
  );
}
