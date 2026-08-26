"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "@/lib/actions/users";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export function ChangeOwnPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [succeeded, setSucceeded] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    passwordsMatch &&
    !isPending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!passwordsMatch) {
      toast.error("New passwords do not match");
      return;
    }

    startTransition(async () => {
      const res = await changeOwnPassword({ currentPassword, newPassword });
      if (res.success) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSucceeded(true);
        setTimeout(() => setSucceeded(false), 4000);
      } else {
        toast.error(res.error || "Failed to change password");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {/* Current Password */}
      <div>
        <label className="block text-xs font-medium mb-1.5">
          Current Password
        </label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            placeholder="Enter your current password"
            className="w-full h-9 px-3 pr-10 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* New Password */}
      <div>
        <label className="block text-xs font-medium mb-1.5">New Password</label>
        <div className="relative">
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full h-9 px-3 pr-10 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {newPassword.length > 0 && newPassword.length < 6 && (
          <p className="text-xs text-red-500 mt-1">
            Password must be at least 6 characters
          </p>
        )}
      </div>

      {/* Confirm New Password */}
      <div>
        <label className="block text-xs font-medium mb-1.5">
          Confirm New Password
        </label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Re-enter new password"
            className={`w-full h-9 px-3 pr-10 border rounded-sm text-sm focus:outline-none focus:ring-1 bg-background transition-colors ${
              confirmPassword.length > 0 && !passwordsMatch
                ? "border-red-400 focus:ring-red-400"
                : "border-border focus:ring-foreground"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Update Password
        </button>

        {succeeded && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium animate-in fade-in slide-in-from-left-2 duration-300">
            <CheckCircle2 size={14} />
            Password updated!
          </span>
        )}
      </div>
    </form>
  );
}
