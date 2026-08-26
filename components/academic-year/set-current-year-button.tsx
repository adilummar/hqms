"use client";

import { useTransition } from "react";
import { setCurrentAcademicYear } from "@/lib/actions/academic-year";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

interface Props {
  yearId: string;
  yearLabel: string;
}

export function SetCurrentYearButton({ yearId, yearLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await setCurrentAcademicYear(yearId);
      if (res.success) {
        toast.success(`"${yearLabel}" is now the current academic year`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to set current year");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal/10 border border-teal/30 text-teal-700 font-medium rounded-lg hover:bg-teal/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Set "${yearLabel}" as current academic year`}
    >
      {isPending ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Play size={12} />
      )}
      {isPending ? "Setting…" : "Set as Current"}
    </button>
  );
}
