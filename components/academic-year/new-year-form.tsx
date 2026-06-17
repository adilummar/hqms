"use client";

import { useState, useTransition } from "react";
import { createAcademicYear, createBatch } from "@/lib/actions/academic-year";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, CheckCircle, HelpCircle } from "lucide-react";

interface Props {
  nextBatchNumber: number;
}

type Step = "idle" | "form" | "batch-prompt" | "done";

export function NewAcademicYearForm({ nextBatchNumber }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [isPending, startTransition] = useTransition();
  const [isBatchPending, startBatchTransition] = useTransition();
  const [createdYearLabel, setCreatedYearLabel] = useState("");

  // ── Step 1: Create Academic Year ──────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createAcademicYear({
        startDate: (fd.get("startDate") as string) || undefined,
        endDate:   (fd.get("endDate")   as string) || undefined,
        label:     (fd.get("label")     as string) || undefined,
      });
      if (res.success) {
        setCreatedYearLabel(res.data?.label ?? "");
        toast.success(`Academic Year "${res.data?.label}" created and set as current!`);
        setStep("batch-prompt");
      } else {
        toast.error(res.error ?? "Failed to create academic year");
      }
    });
  }

  // ── Step 2a: Create Batch ─────────────────────────────────────
  function handleCreateBatch() {
    startBatchTransition(async () => {
      const res = await createBatch({ batchNumber: nextBatchNumber });
      if (res.success) {
        toast.success(`Batch ${nextBatchNumber} created successfully!`);
        setStep("done");
        setTimeout(() => { setStep("idle"); router.refresh(); }, 1200);
      } else {
        toast.error(res.error ?? "Failed to create batch");
      }
    });
  }

  // ── Step 2b: Skip Batch ───────────────────────────────────────
  function handleSkipBatch() {
    toast.info("Batch creation skipped. You can add one later from the Batches section.");
    setStep("idle");
    router.refresh();
  }

  // ── Idle: just the trigger button ────────────────────────────
  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("form")}
        className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
      >
        <Plus size={16} />
        Start New Academic Year
      </button>
    );
  }

  // ── Done overlay ──────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-6 flex items-center gap-3">
        <CheckCircle className="text-green-500 shrink-0" size={24} />
        <div>
          <p className="font-semibold text-green-800 text-sm">All done!</p>
          <p className="text-xs text-green-600">Academic year and batch created.</p>
        </div>
      </div>
    );
  }

  // ── Step 1: Year form ─────────────────────────────────────────
  if (step === "form") {
    return (
      <div className="border border-amber-300 bg-amber-50 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-playfair font-semibold text-base text-amber-900">
            📅 Start New Academic Year
          </h3>
          <button onClick={() => setStep("idle")} className="text-amber-600 hover:text-amber-900">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-amber-700 mb-1">
          This creates a new <strong>time period</strong> for classes, enrollments, and exams.
          All active classes from the current year will be cloned automatically.
        </p>
        <p className="text-xs text-amber-600 mb-4">
          After creating the year, you&apos;ll be asked whether to also create a new <strong>Batch</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Year Label <span className="text-amber-400 font-normal">(optional)</span>
              </label>
              <input
                name="label"
                type="text"
                placeholder="e.g. 2024-25"
                className="w-full h-9 px-3 border border-amber-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Start Date <span className="text-amber-400 font-normal">(optional)</span>
              </label>
              <input
                name="startDate"
                type="date"
                className="w-full h-9 px-3 border border-amber-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                End Date <span className="text-amber-400 font-normal">(optional)</span>
              </label>
              <input
                name="endDate"
                type="date"
                className="w-full h-9 px-3 border border-amber-300 rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Create Academic Year →
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Step 2: Batch prompt ──────────────────────────────────────
  return (
    <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-5">
      <div className="flex items-start gap-3 mb-4">
        <HelpCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-playfair font-semibold text-base text-emerald-900">
            Academic Year &ldquo;{createdYearLabel}&rdquo; created!
          </h3>
          <p className="text-sm text-emerald-700 mt-1">
            Do you also want to create a new <strong>Batch</strong>?
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            A batch groups students into a permanent cohort.
            The next batch would be <strong>Batch {nextBatchNumber}</strong>.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCreateBatch}
          disabled={isBatchPending}
          className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {isBatchPending && <Loader2 size={14} className="animate-spin" />}
          ✓ Yes, Create Batch {nextBatchNumber}
        </button>
        <button
          onClick={handleSkipBatch}
          disabled={isBatchPending}
          className="px-4 py-2 text-sm font-medium text-emerald-700 border border-emerald-300 rounded-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
}
