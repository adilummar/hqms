"use client";

import { useState, useTransition } from "react";
import { createAcademicYear } from "@/lib/actions/academic-year";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

export function NewAcademicYearForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createAcademicYear({
        label: fd.get("label") as string,
        startDate: fd.get("startDate") as string,
        endDate: fd.get("endDate") as string,
      });
      if (res.success) {
        toast.success(`Academic year "${res.data?.label}" created successfully!`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to create academic year");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
      >
        <Plus size={16} />
        Start New Academic Year
      </button>
    );
  }

  return (
    <div className="border border-amber-300 bg-amber-50 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-playfair font-semibold text-base text-amber-900">
          🎓 Start New Academic Year
        </h3>
        <button onClick={() => setOpen(false)} className="text-amber-600 hover:text-amber-900">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-amber-700 mb-4">
        Creating a new academic year will mark it as the current year and clone all active classes
        from the current year. Students will need to be promoted manually afterwards.
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Year Label <span className="text-amber-500">(e.g. 2025-26)</span>
          </label>
          <input
            name="label"
            type="text"
            required
            placeholder="2025-26"
            pattern="\d{4}-\d{2}"
            className="w-full h-9 px-3 border border-amber-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-amber-800 mb-1">Start Date</label>
          <input
            name="startDate"
            type="date"
            required
            className="w-full h-9 px-3 border border-amber-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-amber-800 mb-1">End Date</label>
          <input
            name="endDate"
            type="date"
            required
            className="w-full h-9 px-3 border border-amber-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Create Academic Year
          </button>
        </div>
      </form>
    </div>
  );
}
