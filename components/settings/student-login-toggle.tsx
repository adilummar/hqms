"use client";

import { useState, useTransition } from "react";
import { toggleStudentLogin } from "@/lib/actions/settings";
import { toast } from "sonner";

interface StudentLoginToggleProps {
  initialEnabled: boolean;
}

export function StudentLoginToggle({ initialEnabled }: StudentLoginToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const res = await toggleStudentLogin(enabled);
      if (res.success) {
        setEnabled(res.enabled);
        toast.success(
          res.enabled
            ? "Student login enabled — students can now log in"
            : "Student login disabled — students cannot log in"
        );
      } else {
        toast.error("Failed to update setting");
      }
    });
  };

  return (
    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
      <div>
        <p className="font-medium text-sm">Student Portal Access</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {enabled
            ? "Students can currently log in and view their results"
            : "Students cannot log in — portal is locked"}
        </p>
      </div>

      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-green-500" : "bg-muted"
        }`}
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle student login"
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
