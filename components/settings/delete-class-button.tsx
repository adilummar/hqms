"use client";

import { useState, useTransition } from "react";
import { deleteClass } from "@/lib/actions/classes";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  cls: {
    id: string;
    name: string;
  };
}

export function DeleteClassButton({ cls }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteClass({ id: cls.id });
      if (res.success) {
        toast.success(`Class "${cls.name}" deleted successfully`);
        setOpen(false);
      } else {
        toast.error(res.error || "Failed to delete class");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline px-2 py-1 transition-colors"
            aria-label={`Delete class ${cls.name}`}
          />
        }
      >
        Delete
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600">
              <Trash2 size={16} />
            </span>
            Delete Class
          </DialogTitle>
          <DialogDescription className="pt-1">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{cls.name}</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 mt-1">
          ⚠️ Deletion will fail if this class still has students or exam records linked to it.
        </p>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? "Deleting…" : "Delete Class"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
