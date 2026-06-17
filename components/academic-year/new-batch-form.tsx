"use client";

import { useState, useTransition } from "react";
import { createBatch } from "@/lib/actions/academic-year";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

interface Props {
  nextBatchNumber: number;
}

export function NewBatchForm({ nextBatchNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const batchNum = parseInt(fd.get("batchNumber") as string, 10);
    const notes    = (fd.get("notes") as string)?.trim() || undefined;

    if (isNaN(batchNum) || batchNum < 1) {
      toast.error("Please enter a valid batch number.");
      return;
    }

    startTransition(async () => {
      const res = await createBatch({ batchNumber: batchNum, notes });
      if (res.success) {
        toast.success(`Batch ${res.data?.batchNumber} (${res.data?.label}) created!`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to create batch");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
      >
        <Plus size={14} />
        Add New Batch
      </button>
    );
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-5 w-full mt-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-playfair font-semibold text-base text-blue-900">
          🎓 Add New Batch
        </h3>
        <button onClick={() => setOpen(false)} className="text-blue-500 hover:text-blue-800">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-blue-700 mb-4">
        A batch is a <strong>permanent student cohort</strong>. The next suggested batch number
        is <strong>Batch {nextBatchNumber}</strong>.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-blue-800 mb-1">
              Batch Number *
            </label>
            <input
              name="batchNumber"
              type="number"
              min={1}
              defaultValue={nextBatchNumber}
              required
              className="w-full h-9 px-3 border border-blue-200 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-blue-800 mb-1">
              Notes <span className="text-blue-400 font-normal">(optional)</span>
            </label>
            <input
              name="notes"
              type="text"
              placeholder="e.g. Started June 2024"
              className="w-full h-9 px-3 border border-blue-200 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Create Batch {nextBatchNumber}
          </button>
        </div>
      </form>
    </div>
  );
}
