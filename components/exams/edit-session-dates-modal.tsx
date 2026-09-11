"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSessionDates } from "@/lib/actions/exams";
import { toast } from "sonner";
import { Loader2, Calendar } from "lucide-react";

export function EditSessionDatesModal({ 
  sessionId, 
  initialStart, 
  initialEnd, 
  trackName 
}: { 
  sessionId: string, 
  initialStart: string | null, 
  initialEnd: string | null,
  trackName: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;

    startTransition(async () => {
      const result = await updateSessionDates(sessionId, startDate, endDate);
      
      if (result.success) {
        toast.success(`${trackName} schedule updated`);
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update schedule");
      }
    });
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background text-xs font-medium rounded hover:bg-muted transition-colors"
      >
        <Calendar size={14} /> Edit Dates
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-lg capitalize">{trackName} Schedule</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input 
                  type="date" 
                  name="startDate" 
                  defaultValue={initialStart || ""} 
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input 
                  type="date" 
                  name="endDate" 
                  defaultValue={initialEnd || ""} 
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted font-medium">Cancel</button>
                <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 font-medium">
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
