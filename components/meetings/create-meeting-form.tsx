"use client";

import { useState, useTransition } from "react";
import { createParentMeeting } from "@/lib/actions/parent-meetings";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

export function CreateMeetingForm() {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [description, setDescription] = useState("");

  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createParentMeeting({ title, meetingDate, description });
      if (result.success) {
        toast.success("Meeting scheduled successfully");
        setTitle("");
        setMeetingDate("");
        setDescription("");
        setOpen(false);
      } else {
        toast.error("Failed to create meeting");
      }
    });
  }

  if (!open) {
    return (
      <button
        id="create-meeting-btn"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
      >
        <Plus size={16} />
        Schedule New Meeting
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 mb-6">
      <h3 className="font-playfair text-base font-semibold mb-4">Schedule Parent Meeting</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Meeting Title <span className="text-red-500">*</span>
            </label>
            <input
              id="meeting-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Term 1 Parent-Teacher Meeting"
              required
              className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Meeting Date <span className="text-red-500">*</span>
            </label>
            <input
              id="meeting-date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              min={today}
              required
              className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            Description / Notes (optional)
          </label>
          <textarea
            id="meeting-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any additional details about the meeting..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            id="submit-meeting-btn"
            type="submit"
            disabled={isPending || !title || !meetingDate}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? "Scheduling..." : "Schedule Meeting"}
          </button>
        </div>
      </form>
    </div>
  );
}
