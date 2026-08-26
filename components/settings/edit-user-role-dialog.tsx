"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole } from "@/lib/actions/users";
import { toast } from "sonner";
import { UserCog, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ALL_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "school_admin", label: "School Admin" },
  { value: "tutor", label: "Tutor" },
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
];

interface Props {
  userId: string;
  username: string;
  currentRole: string;
  isCurrentUser: boolean;
}

export function EditUserRoleDialog({ userId, username, currentRole, isCurrentUser }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState(currentRole);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCurrentUser) return;
    if (selectedRole === currentRole) {
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await updateUserRole({ targetUserId: userId, newRole: selectedRole });
      if (result.success) {
        toast.success(`Role updated for ${username}`);
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update role");
      }
    });
  };

  if (isCurrentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button
            title={`Edit role for ${username}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
          />
        }
      >
        <UserCog size={11} />
        Role
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Role</DialogTitle>
          <DialogDescription>
            Change the system access level for <strong>{username}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isPending}
            >
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || selectedRole === currentRole}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
