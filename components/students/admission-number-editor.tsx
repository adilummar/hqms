"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateAdmissionNumber } from "@/lib/actions/student-profile";

interface Props {
  studentId: string;
  currentAdmissionNumber: string | null;
}

export function AdmissionNumberEditor({ studentId, currentAdmissionNumber }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentAdmissionNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setValue(currentAdmissionNumber ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateAdmissionNumber(studentId, value);
      if (res.success) {
        setEditing(false);
      } else {
        setError(res.error ?? "Failed to update");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <span className="font-jetbrains text-xs bg-foreground text-background px-2 py-0.5 rounded">
          {currentAdmissionNumber ? `AD No. ${currentAdmissionNumber}` : "No AD Number"}
        </span>
        <button
          onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
          title="Edit admission number"
        >
          <Pencil size={11} className="text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground shrink-0">AD No.</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          placeholder="e.g. 150"
          className="w-24 px-2 py-0.5 text-xs border border-border rounded bg-card outline-none focus:ring-1 focus:ring-foreground/30 font-jetbrains"
        />
        <button
          onClick={save}
          disabled={isPending}
          className="p-1 rounded bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
          title="Save"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button
          onClick={cancel}
          className="p-1 rounded border border-border hover:bg-muted transition-colors"
          title="Cancel"
        >
          <X size={11} />
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
