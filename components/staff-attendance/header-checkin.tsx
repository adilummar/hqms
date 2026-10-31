"use client";

import { useState, useEffect, useTransition } from "react";
import { checkInStaff, getStaffCheckInStatus } from "@/lib/actions/staff-attendance";
import { STAFF_ROLES } from "@/lib/constants/staff";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface HeaderCheckInProps {
  role: string;
}

export function HeaderCheckIn({ role }: HeaderCheckInProps) {
  const isStaff = (STAFF_ROLES as readonly string[]).includes(role);

  const [isPending, startTransition] = useTransition();
  const [checkedIn, setCheckedIn] = useState<boolean | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);

  useEffect(() => {
    if (!isStaff) return;
    let mounted = true;

    getStaffCheckInStatus()
      .then((res) => {
        if (!mounted) return;
        if (res.isStaff) {
          setCheckedIn(res.checkedIn);
          setCheckInTime(res.checkInTime);
        }
      })
      .catch((err) => {
        console.error("Failed to load staff check-in status:", err);
      });

    return () => {
      mounted = false;
    };
  }, [isStaff]);

  if (!isStaff) return null;

  function handleCheckIn() {
    startTransition(async () => {
      try {
        const result = await checkInStaff();
        if (result.success) {
          setCheckedIn(true);
          setCheckInTime(result.checkInTime ?? "Now");
          toast.success("Attendance marked!", {
            description: `You have successfully checked in at ${result.checkInTime}`,
          });
        } else {
          toast.error(result.error ?? "Failed to check in");
        }
      } catch (err) {
        toast.error("Failed to check in. Please try again.");
      }
    });
  }

  // Initial loading skeleton placeholder
  if (checkedIn === null) {
    return (
      <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse hidden sm:block" />
    );
  }

  if (checkedIn) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium select-none shadow-2xs"
        title={`Checked in today at ${checkInTime}`}
      >
        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
        <span className="hidden md:inline font-dm-sans">Checked In</span>
        <span className="font-semibold text-emerald-700 font-jetbrains text-[11px] sm:text-xs">
          {checkInTime}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all duration-150 disabled:opacity-60 cursor-pointer"
      title="Click to check in and mark your attendance for today"
    >
      {isPending ? (
        <Loader2 size={13} className="animate-spin shrink-0" />
      ) : (
        <Clock size={13} className="shrink-0 animate-pulse" />
      )}
      <span className="font-dm-sans tracking-wide">
        {isPending ? "Checking in..." : "Check In"}
      </span>
    </button>
  );
}
