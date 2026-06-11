"use client";

import { useState, useTransition } from "react";
import { awardStar, removeStar } from "@/lib/actions/stars";
import { toast } from "sonner";
import { Loader2, Star, X } from "lucide-react";

interface StarEntry {
  id: string;
  type: "blue" | "black";
  reason: string;
  awardedAt: Date | string;
  awardedBy: string;
  awardedByUser?: { username: string } | null;
}

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
}

interface Props {
  student: Student;
  existingStars: StarEntry[];
  currentUserId: string;
  canRemoveAny?: boolean;
}

export function AwardStarForm({
  student,
  existingStars: initial,
  currentUserId,
  canRemoveAny = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [stars, setStars] = useState<StarEntry[]>(initial);
  const [type, setType] = useState<"blue" | "black">("blue");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  const blueCount = stars.filter((star) => star.type === "blue").length;
  const blackCount = stars.filter((star) => star.type === "black").length;

  function handleAward(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await awardStar({ studentId: student.id, type, reason });
      if (result.success && result.data) {
        setStars((previous) => [
          { ...result.data, awardedByUser: { username: "You" } },
          ...previous,
        ]);
        setReason("");
        setOpen(false);
        toast.success(
          `${type === "blue" ? "Blue" : "Black"} star awarded to ${student.firstName}`
        );
        return;
      }

      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Failed to award star"
      );
    });
  }

  function handleRemove(starId: string) {
    startTransition(async () => {
      const result = await removeStar(starId);
      if (result.success) {
        setStars((previous) => previous.filter((star) => star.id !== starId));
        toast.success("Star removed");
        return;
      }

      toast.error(result.error ?? "Failed to remove star");
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {student.firstName} {student.lastName ?? ""}
          </p>
          <p className="font-jetbrains text-xs text-muted-foreground">
            {student.studentCode}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
              <Star size={12} fill="currentColor" /> {blueCount}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-gray-400 bg-gray-100 px-2 py-0.5 font-semibold text-black">
              <Star size={12} fill="currentColor" /> {blackCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex items-center gap-1.5 rounded-sm bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Star size={12} />
            {open ? "Cancel" : "Award Star"}
          </button>
        </div>
      </div>

      {open && (
        <form
          onSubmit={handleAward}
          className="space-y-3 border-b border-border bg-card px-4 py-3"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setType("blue")}
              className={`flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition-all ${
                type === "blue"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:border-blue-400"
              }`}
            >
              <Star size={16} fill="currentColor" />
              Blue Star
              <span className="text-xs font-normal opacity-75">(Good)</span>
            </button>
            <button
              type="button"
              onClick={() => setType("black")}
              className={`flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition-all ${
                type === "black"
                  ? "border-black bg-black text-white"
                  : "border-border bg-background text-muted-foreground hover:border-gray-500"
              }`}
            >
              <Star size={16} fill="currentColor" />
              Black Star
              <span className="text-xs font-normal opacity-75">(Warning)</span>
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                type === "blue"
                  ? "Example: Excellent recitation or helpful behaviour"
                  : "Example: Repeated late arrival or disruptive behaviour"
              }
              rows={2}
              required
              maxLength={500}
              className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || reason.trim().length < 3}
              className={`flex items-center gap-1.5 rounded-sm px-4 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                type === "blue"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-black hover:bg-gray-900"
              }`}
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Award {type === "blue" ? "Blue" : "Black"} Star
            </button>
          </div>
        </form>
      )}

      {stars.length > 0 && (
        <div className="divide-y divide-border">
          {stars.slice(0, 5).map((star) => (
            <div
              key={star.id}
              className={`flex items-start justify-between gap-3 px-4 py-2.5 text-xs ${
                star.type === "blue" ? "bg-blue-50/20" : "bg-gray-50/50"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Star
                  size={16}
                  fill="currentColor"
                  className={
                    star.type === "blue"
                      ? "shrink-0 text-blue-600"
                      : "shrink-0 text-black"
                  }
                />
                <div>
                  <p className="leading-relaxed text-muted-foreground">
                    {star.reason}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    By {star.awardedByUser?.username ?? "Teacher"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-jetbrains text-muted-foreground">
                  {new Date(star.awardedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {(canRemoveAny || star.awardedBy === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => handleRemove(star.id)}
                    disabled={isPending}
                    className="text-muted-foreground transition-colors hover:text-red-500"
                    title="Remove star"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {stars.length > 5 && (
            <p className="px-4 py-2 text-center text-xs text-muted-foreground">
              + {stars.length - 5} more stars
            </p>
          )}
        </div>
      )}
    </div>
  );
}
