"use client";

import { useTransition } from "react";
import { deleteParentMeeting } from "@/lib/actions/parent-meetings";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this meeting? All attendance records will also be removed.")) return;
    startTransition(async () => {
      const result = await deleteParentMeeting(meetingId);
      if (result.success) {
        toast.success("Meeting deleted");
      } else {
        toast.error("Failed to delete");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
      title="Delete meeting"
    >
      {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  );
}
