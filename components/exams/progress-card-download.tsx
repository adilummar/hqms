"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { renderSingleProgressCard } from "@/lib/actions/progress-cards-bulk";

/** Downloads this exact card (same typed values) as a PDF produced by the server-side renderer. */
export function ProgressCardDownload({
  examinationId,
  studentId,
  overrides,
}: {
  examinationId: string;
  studentId: string;
  overrides: { toBeObtained?: string; memorizedJuz?: string; mentor?: string; madrasaTeacher?: string; schoolTeacher?: string };
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await renderSingleProgressCard({ examinationId, studentId, overrides });
      if (!res.success) { toast.error(res.error); return; }
      const bin = atob(res.card.pdf!);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      a.download = `${res.card.fileStem ?? "progress-card"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      toast.error("Could not generate the PDF");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm font-medium hover:bg-muted disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Download PDF
    </button>
  );
}
