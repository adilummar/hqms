"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, EyeOff, Loader2 } from "lucide-react";
import {
  publishExamResults,
  unpublishExamResults,
  getPublishReadiness,
  setTrackStatus,
  addTrackToExamination,
} from "@/lib/actions/exams";

const inp =
  "h-9 px-2.5 rounded border border-input bg-background text-sm focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all w-full";

/** Per-track publication: review → publish/unpublish ONE track session. */
export function TrackPublishControls({
  examSessionId,
  resultStatus,
  isSuperAdmin,
  publishedAt,
  track,
}: {
  examSessionId: string;
  resultStatus: string;
  isSuperAdmin: boolean;
  publishedAt?: string | null;
  track: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [review, setReview] = useState<null | { subjects: number; expected: number; entered: number; missing: number }>(null);
  const isPublished = resultStatus === "published";
  const label = track.charAt(0).toUpperCase() + track.slice(1);
  const stamp = isPublished && publishedAt ? new Date(publishedAt).toLocaleString() : null;

  function openReview() {
    startTransition(async () => {
      const r = await getPublishReadiness(examSessionId);
      if (!r.success) return void toast.error(r.error);
      setReview(r);
    });
  }

  function publish(allowIncomplete: boolean) {
    startTransition(async () => {
      const r = await publishExamResults(examSessionId, { allowIncomplete });
      if (r.success) {
        toast.success(`${label} results published`);
        setReview(null);
        router.refresh();
      } else toast.error(r.error ?? "Action failed");
    });
  }

  function unpublish() {
    startTransition(async () => {
      const r = await unpublishExamResults(examSessionId);
      if (r.success) {
        toast.success(`${label} results unpublished`);
        router.refresh();
      } else toast.error(r.error ?? "Action failed");
    });
  }

  const badge = (
    <span
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
        isPublished ? "border-green-500/20 bg-green-500/5 text-green-600" : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {isPublished ? <Globe size={13} /> : <EyeOff size={13} />}
      {isPublished ? `${label} published${stamp ? " · " + stamp : ""}` : `${label} not published`}
    </span>
  );

  if (!isSuperAdmin) return badge;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badge}
      {isPublished ? (
        <button
          onClick={unpublish}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />} Unpublish {label}
        </button>
      ) : (
        <button
          onClick={openReview}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/20 disabled:opacity-60"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />} Review &amp; Publish {label}
        </button>
      )}
      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-3">
            <h3 className="font-semibold">Publish {label} results?</h3>
            <p className="text-sm text-muted-foreground">
              Only the {label} track is published. Other tracks of this examination are not affected.
            </p>
            <ul className="text-sm space-y-1">
              <li>
                Subjects: <b>{review.subjects}</b>
              </li>
              <li>
                Marks entered: <b>{review.entered}</b> of <b>{review.expected}</b>
              </li>
              <li className={review.missing > 0 ? "text-amber-600" : "text-green-600"}>
                {review.missing > 0 ? `${review.missing} mark(s) still missing` : "All marks entered"}
              </li>
            </ul>
            {review.subjects === 0 && <p className="text-sm text-red-600">No subjects — cannot publish.</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReview(null)} disabled={isPending} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => publish(review.missing > 0)}
                disabled={isPending || review.subjects === 0}
                className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white disabled:opacity-60"
              >
                {review.missing > 0 ? "Publish anyway" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrackStatusSelect({ examSessionId, status }: { examSessionId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <select
      key={examSessionId + status}
      defaultValue={status}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          const r = await setTrackStatus(examSessionId, e.target.value);
          if (r.success) {
            toast.success("Track status updated");
            router.refresh();
          } else toast.error(r.error);
        })
      }
      className="h-8 px-2 rounded border border-input bg-background text-xs capitalize"
      aria-label="Track exam status"
    >
      {["scheduled", "ongoing", "completed", "cancelled"].map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function ConfigureTrackForm({ examinationId, track }: { examinationId: string; track: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await addTrackToExamination({
        examinationId,
        track,
        startDate: (fd.get("startDate") as string) || null,
        endDate: (fd.get("endDate") as string) || null,
      });
      if (r.success) {
        toast.success(`${track} track configured`);
        router.push(`/admin/exams/${examinationId}?track=${track}`);
        router.refresh();
      } else toast.error(r.error);
    });
  }
  return (
    <form onSubmit={submit} className="bg-card border border-dashed border-border rounded-lg p-6 flex flex-wrap items-end gap-4">
      <div className="w-full">
        <p className="text-sm font-medium capitalize">{track} track is not configured for this examination</p>
        <p className="text-xs text-muted-foreground">
          Set its own period (optional) to start scheduling it. Other tracks are unaffected.
        </p>
      </div>
      <label className="text-xs space-y-1">
        Start date
        <input name="startDate" type="date" className={inp} />
      </label>
      <label className="text-xs space-y-1">
        End date
        <input name="endDate" type="date" className={inp} />
      </label>
      <button disabled={isPending} className="px-4 h-9 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
        {isPending ? "Configuring…" : `Configure ${track}`}
      </button>
    </form>
  );
}
