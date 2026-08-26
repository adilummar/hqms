"use client";

import { useState, useTransition } from "react";
import { createClass } from "@/lib/actions/classes";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ClassTrack = "hifz" | "madrasa" | "school";

interface Props {
  tutors: { id: string; username: string }[];
}

export function AddClassDialog({ tutors }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name") as string,
      track: formData.get("track") as ClassTrack,
      capacity: Number(formData.get("capacity")) || 30,
      tutorId: (formData.get("tutorId") as string) || undefined,
    };

    startTransition(async () => {
      const res = await createClass(data);
      if (res.success) {
        toast.success("Class created successfully");
        setOpen(false);
      } else {
        toast.error(res.error || "Failed to create class");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="px-3 py-1.5 bg-foreground text-background text-sm rounded-sm hover:bg-foreground/90 transition-colors" />}>
        + Add Class
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
          <DialogDescription>
            Create a new class for the current academic year.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium mb-1">Class Name</label>
            <input 
              name="name" 
              required 
              maxLength={20}
              placeholder="e.g. Class 4A"
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Track</label>
            <select 
              name="track" 
              required
              defaultValue="school"
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
            >
              <option value="hifz">Hifz</option>
              <option value="madrasa">Madrasa</option>
              <option value="school">School</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Capacity</label>
            <input 
              name="capacity" 
              type="number"
              min={1}
              defaultValue={30}
              required
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Assigned Tutor (Optional)</label>
            <select 
              name="tutorId" 
              defaultValue=""
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
            >
              <option value="">-- Unassigned --</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>{t.username}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={() => setOpen(false)}
              className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Create Class
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
