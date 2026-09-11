"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExamination } from "@/lib/actions/examinations";
import { toast } from "sonner";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Props {
  examId: string;
  examName: string;
}

export function ExaminationActions({ examId, examName }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setShowConfirm(true);
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteExamination(examId);
      if (result.success) {
        toast.success(`"${examName}" deleted`);
        setShowConfirm(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete exam");
        setShowConfirm(false);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <Link
          href={`/admin/exams/${examId}`}
          className="px-3 py-1.5 border border-border text-xs font-medium rounded hover:bg-muted transition-colors inline-block"
        >
          View & Manage
        </Link>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Delete exam"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Delete Exam?</h3>
                <p className="text-sm text-muted-foreground">
                  You are about to permanently delete{" "}
                  <span className="font-medium text-foreground">"{examName}"</span>.
                  All its sessions, tracks, and student marks will be erased.
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
