"use client";

import { useState, useTransition } from "react";
import { deleteAcademicYear } from "@/lib/actions/academic-year";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, AlertTriangle, X } from "lucide-react";

interface Props {
  yearId: string;
  yearLabel: string;
}

export function DeleteAcademicYearButton({ yearId, yearLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAcademicYear(yearId);
      if (res.success) {
        toast.success(`Academic year "${yearLabel}" deleted`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to delete academic year");
        setOpen(false);
      }
    });
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
        title={`Delete "${yearLabel}"`}
      >
        <Trash2 size={12} />
        Delete
      </button>

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <X size={16} />
            </button>

            {/* Icon + heading */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-[15px] font-inter">
                  Delete Academic Year?
                </h3>
                <p className="text-sm text-muted-foreground mt-1 font-dm-sans">
                  You are about to permanently delete{" "}
                  <span className="font-semibold text-foreground">"{yearLabel}"</span>.
                </p>
              </div>
            </div>

            {/* Warning box */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
              <p className="text-xs text-red-700 font-dm-sans leading-relaxed">
                <span className="font-semibold">This action cannot be undone.</span> The year will
                be permanently removed. Deletion is blocked if any classes or enrollments are still
                linked to this year.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50 font-dm-sans"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-dm-sans"
              >
                {isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                {isPending ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
