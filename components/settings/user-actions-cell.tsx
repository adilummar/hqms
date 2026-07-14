"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUserStatus, deleteUser } from "@/lib/actions/users";
import { Trash2, PowerOff, Power, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  userId: string;
  username: string;
  role: string;
  isActive: boolean;
  isCurrentUser: boolean;
}

export function UserActionsCell({
  userId,
  username,
  role,
  isActive,
  isCurrentUser,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isSelf = isCurrentUser;
  const isSuperAdmin = role === "super_admin";

  // ── Toggle disable / enable ──────────────────────────────────────────────────

  const handleToggleStatus = () => {
    if (isSelf) return;
    const action = isActive ? "disable" : "enable";
    if (isActive && !confirm(`Disable "${username}"?\n\nThey will be locked out immediately and cannot log in until re-enabled.`)) return;

    startTransition(async () => {
      const result = await toggleUserStatus(userId, !isActive);
      if (result.success) {
        toast.success(`User "${username}" ${isActive ? "disabled" : "enabled"}.`);
        router.refresh();
      } else {
        toast.error(result.error ?? `Failed to ${action} user.`);
      }
    });
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (isSelf) return;
    if (!deleteConfirm) {
      // First click — arm the button
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000); // auto-disarm after 3s
      return;
    }
    // Second click — actually delete
    setDeleteConfirm(false);
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.success) {
        toast.success(`User "${username}" deleted.`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete user.");
      }
    });
  };

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground italic">—</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Disable / Enable */}
      <button
        onClick={handleToggleStatus}
        disabled={isPending}
        title={isActive ? `Disable ${username}` : `Enable ${username}`}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50",
          isActive
            ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
            : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
        )}
      >
        {isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : isActive ? (
          <PowerOff size={11} />
        ) : (
          <Power size={11} />
        )}
        {isActive ? "Disable" : "Enable"}
      </button>

      {/* Delete — two-click confirm */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        title={
          deleteConfirm
            ? "Click again to confirm deletion"
            : `Delete ${username}`
        }
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all disabled:opacity-50",
          deleteConfirm
            ? "border-red-400 text-red-700 bg-red-100 ring-1 ring-red-300 animate-pulse"
            : "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
        )}
      >
        <Trash2 size={11} />
        {deleteConfirm ? "Confirm?" : "Delete"}
      </button>
    </div>
  );
}
