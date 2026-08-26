"use client";

import { useState, useTransition } from "react";
import { adminResetUserPassword } from "@/lib/actions/users";
import { toast } from "sonner";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ResetUserPasswordDialogProps {
  userId: string;
  username: string;
  role: string;
}

export function ResetUserPasswordDialog({
  userId,
  username,
  role,
}: ResetUserPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminResetUserPassword({
        targetUserId: userId,
        newPassword: password,
      });
      if (res.success) {
        toast.success(`Password reset for ${username}`);
        setOpen(false);
        setPassword("");
      } else {
        toast.error(res.error || "Failed to reset password");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPassword("");
      }}
    >
      <DialogTrigger render={
        <button
          title={`Reset password for ${username}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
        />
      }>
        <KeyRound size={12} />
        Reset Password
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Set a new password for{" "}
            <span className="font-semibold font-jetbrains text-foreground">
              {username}
            </span>{" "}
            <span className="capitalize text-muted-foreground">
              ({role.replace("_", " ")})
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full h-9 px-3 pr-10 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              The user will need to use this password to log in.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || password.length < 6}
              className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Reset Password
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
