"use client";

import { useState, useTransition } from "react";
import { updateStudentStatus } from "@/lib/actions/students";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

type StudentStatus = "active" | "completed" | "discontinued";

interface Props {
  studentId: string;
  currentStatus: StudentStatus;
  studentName: string;
}

export function StudentStatusPanel({ studentId, currentStatus, studentName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState<StudentStatus | "">("");

  const statusConfig = {
    active: {
      label: "Active",
      color: "bg-green-50 border-green-200 text-green-800",
      dot: "bg-green-500",
      icon: <CheckCircle size={14} className="text-green-600" />,
    },
    completed: {
      label: "Completed",
      color: "bg-blue-50 border-blue-200 text-blue-800",
      dot: "bg-blue-500",
      icon: <CheckCircle size={14} className="text-blue-600" />,
    },
    discontinued: {
      label: "Discontinued",
      color: "bg-red-50 border-red-200 text-red-800",
      dot: "bg-red-400",
      icon: <XCircle size={14} className="text-red-500" />,
    },
  };

  const current = statusConfig[currentStatus];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newStatus) return;

    const fd = new FormData(e.currentTarget);
    const completionDate       = fd.get("completionDate") as string || undefined;
    const discontinuationDate  = fd.get("discontinuationDate") as string || undefined;
    const discontinuationReason = fd.get("discontinuationReason") as string || undefined;

    startTransition(async () => {
      const res = await updateStudentStatus({
        id:                    studentId,
        status:                newStatus,
        completionDate:        newStatus === "completed"     ? completionDate       : undefined,
        discontinuationDate:   newStatus === "discontinued"  ? discontinuationDate  : undefined,
        discontinuationReason: newStatus === "discontinued"  ? discontinuationReason : undefined,
      });

      if (res.success) {
        toast.success(`${studentName}'s status updated to ${newStatus}`);
        setOpen(false);
        setNewStatus("");
        router.refresh();
      } else {
        toast.error("Failed to update status");
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-playfair text-base font-semibold">Student Status</h3>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${current.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
            {current.label}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </button>

      {/* Change status panel */}
      {open && (
        <div className="border-t border-border px-5 py-4 bg-muted/10">
          {/* Status explanation */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(["active", "completed", "discontinued"] as const).map((s) => {
              const cfg = statusConfig[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewStatus(s === currentStatus ? "" : s)}
                  disabled={s === currentStatus}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    s === currentStatus
                      ? `${cfg.color} opacity-60 cursor-not-allowed`
                      : newStatus === s
                      ? `${cfg.color} ring-2 ring-offset-1 ring-current`
                      : "bg-background border-border hover:border-foreground/30 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {cfg.icon}
                    <span className="text-xs font-semibold capitalize">{s}</span>
                    {s === currentStatus && (
                      <span className="text-[10px] font-normal opacity-70">(current)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {s === "active"        && "Currently enrolled & attending"}
                    {s === "completed"     && "Finished the Hifz program"}
                    {s === "discontinued"  && "Left before completion"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Additional fields based on new status */}
          {newStatus && newStatus !== currentStatus && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {newStatus === "discontinued" && (
                <>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">
                      Marking as discontinued will deactivate this student from all active reports and
                      attendance. This can be reversed later.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Date of Discontinuation *
                    </label>
                    <input
                      name="discontinuationDate"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="w-full h-9 px-3 border border-border rounded-sm text-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Reason for Discontinuation
                      <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      name="discontinuationReason"
                      rows={2}
                      placeholder="e.g. Family relocation, health reasons…"
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                    />
                  </div>
                </>
              )}

              {newStatus === "completed" && (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2">
                    <CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700">
                      Marking as completed means this student has finished the full Hifz program.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Completion Date *
                    </label>
                    <input
                      name="completionDate"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="w-full h-9 px-3 border border-border rounded-sm text-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </div>
                </>
              )}

              {newStatus === "active" && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-700">
                    This will reactivate the student. They will appear in all active student reports again.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setNewStatus(""); }}
                  className="px-4 py-1.5 text-sm border border-border rounded-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-sm transition-colors disabled:opacity-50 text-white ${
                    newStatus === "discontinued"
                      ? "bg-red-600 hover:bg-red-700"
                      : newStatus === "completed"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  Confirm: Mark as{" "}
                  {newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}
                </button>
              </div>
            </form>
          )}

          {!newStatus && (
            <p className="text-xs text-muted-foreground text-center py-1">
              Select a status above to change it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
