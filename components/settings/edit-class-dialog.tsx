"use client";

import { useState, useTransition } from "react";
import { updateClass } from "@/lib/actions/classes";
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
  cls: {
    id: string;
    name: string;
    track: string;
    capacity: number | null;
    tutorId: string | null;
    isActive: boolean;
  };
  tutors: { id: string; username: string }[];
}

export function EditClassDialog({ cls, tutors }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      id: cls.id,
      name: formData.get("name") as string,
      track: formData.get("track") as ClassTrack,
      capacity: Number(formData.get("capacity")) || 30,
      tutorId: (formData.get("tutorId") as string) || undefined,
      isActive: formData.get("isActive") === "true",
    };

    startTransition(async () => {
      const res = await updateClass(data);
      if (res.success) {
        toast.success("Class updated successfully");
        setOpen(false);
      } else {
        toast.error(res.error || "Failed to update class");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="text-xs font-medium text-blue-600 hover:underline px-2 py-1" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Class</DialogTitle>
          <DialogDescription>
            Modify the details for {cls.name}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium mb-1">Class Name</label>
            <input 
              name="name" 
              required 
              maxLength={20}
              defaultValue={cls.name}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Track</label>
            <select 
              name="track" 
              required
              defaultValue={cls.track}
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
              defaultValue={cls.capacity || 30}
              required
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Assigned Tutor</label>
            <select 
              name="tutorId" 
              defaultValue={cls.tutorId || ""}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
            >
              <option value="">-- Unassigned --</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>{t.username}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Status</label>
            <select 
              name="isActive" 
              required
              defaultValue={cls.isActive ? "true" : "false"}
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
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
              Save Changes
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
