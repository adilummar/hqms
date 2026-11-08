"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  checkInStaff,
  getStaffCheckInStatus,
  type StaffCheckInStatus,
} from "@/lib/actions/staff-attendance";
import { CheckCircle2, Clock, Loader2, Lock, CalendarOff } from "lucide-react";
import { toast } from "sonner";

interface HeaderCheckInProps {
  role: string;
}

/**
 * Staff check-in pill. Only eligible Hifz tutors see it. The server decides
 * which session is open (FN 6:00–14:00, AN 14:00–23:00 IST); the browser only
 * re-fetches at the next boundary the server reported.
 */
export function HeaderCheckIn({ role }: HeaderCheckInProps) {
  const isTutor = role === "tutor";

  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<StaffCheckInStatus | null>(null);

  const refresh = useCallback(() => {
    getStaffCheckInStatus()
      .then((res) => setStatus(res))
      .catch((err) => console.error("Failed to load staff check-in status:", err));
  }, []);

  useEffect(() => {
    if (!isTutor) return;
    refresh();
  }, [isTutor, refresh]);

  // Re-check at the next session boundary (and when the tab regains focus).
  useEffect(() => {
    if (!isTutor || !status?.isStaff) return;
    const timer = setTimeout(refresh, Math.max(status.msToNextBoundary, 1000) + 500);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isTutor, status, refresh]);

  if (!isTutor) return null;

  if (status === null) {
    return <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse hidden sm:block" />;
  }
  if (!status.isStaff) return null;

  function handleCheckIn() {
    startTransition(async () => {
      try {
        const result = await checkInStaff();
        if (result.success) {
          toast.success("Attendance marked!", {
            description: `${result.session ? result.session + " — " : ""}checked in at ${result.checkInTime}`,
          });
        } else {
          toast.error(result.error ?? "Failed to check in");
        }
        refresh();
      } catch {
        toast.error("Failed to check in. Please try again.");
      }
    });
  }

  // ── Legacy single-session day ──
  if (status.mode === "legacy" && status.legacy) {
    if (status.legacy.checkedIn) {
      return (
        <Pill tone="ok" title={`Checked in today at ${status.legacy.time}`}>
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          <span className="hidden md:inline font-dm-sans">Checked In</span>
          <span className="font-semibold text-emerald-700 font-jetbrains text-[11px] sm:text-xs">
            {status.legacy.time}
          </span>
        </Pill>
      );
    }
    return <CheckInButton pending={isPending} onClick={handleCheckIn} label="Check In" />;
  }

  // ── FN / AN day ──
  const s = status.sessions!;
  const active = status.activeSession;

  if (active) {
    const cell = s[active];
    if (status.offLabel) {
      return (
        <Pill tone="muted" title={`${active} is an off day: ${status.offLabel}`}>
          <CalendarOff size={13} className="shrink-0" />
          <span className="font-dm-sans">{status.offLabel}</span>
        </Pill>
      );
    }
    if (cell.status === "present") {
      return (
        <Pill tone="ok" title={`${active} checked in at ${cell.time}`}>
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          <span className="font-semibold font-dm-sans">{active}</span>
          <span className="font-semibold text-emerald-700 font-jetbrains text-[11px] sm:text-xs">
            {cell.time}
          </span>
        </Pill>
      );
    }
    if (cell.status === "absent" || cell.status === "leave") {
      return (
        <Pill tone="bad" title={`${active} is recorded as ${cell.status}. Only an admin can change it.`}>
          <Lock size={13} className="shrink-0" />
          <span className="font-dm-sans capitalize">
            {active} {cell.status}
          </span>
        </Pill>
      );
    }
    return <CheckInButton pending={isPending} onClick={handleCheckIn} label={`Check In ${active}`} />;
  }

  // No window open (before 6:00 or after 23:00): show a summary of today.
  const fn = s.FN.status;
  const an = s.AN.status;
  return (
    <Pill
      tone={fn === "present" || an === "present" ? "ok" : "muted"}
      title={`FN: ${fn}${s.FN.time ? " " + s.FN.time : ""} · AN: ${an}${s.AN.time ? " " + s.AN.time : ""}`}
    >
      <Clock size={13} className="shrink-0" />
      <span className="font-jetbrains text-[11px]">
        FN {label(fn)} · AN {label(an)}
      </span>
    </Pill>
  );
}

function label(c: string): string {
  switch (c) {
    case "present":
      return "✓";
    case "absent":
      return "✗";
    case "leave":
      return "L";
    case "off":
      return "off";
    case "unmarked":
      return "✗";
    default:
      return "–";
  }
}

function Pill({
  tone,
  title,
  children,
}: {
  tone: "ok" | "bad" | "muted";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
    bad: "bg-red-50 border-red-200 text-red-700",
    muted: "bg-slate-50 border-slate-200 text-slate-600",
  };
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium select-none shadow-2xs ${tones[tone]}`}
      title={title}
    >
      {children}
    </div>
  );
}

function CheckInButton({
  pending,
  onClick,
  label,
}: {
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all duration-150 disabled:opacity-60 cursor-pointer"
      title="Click to mark your attendance for this session"
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin shrink-0" />
      ) : (
        <Clock size={13} className="shrink-0 animate-pulse" />
      )}
      <span className="font-dm-sans tracking-wide">{pending ? "Checking in..." : label}</span>
    </button>
  );
}
