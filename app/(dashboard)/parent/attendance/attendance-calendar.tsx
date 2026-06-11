"use client";

import { Calendar } from "@/components/ui/calendar";

interface Props {
  presentDates: string[];
  absentDates: string[];
  leaveDates: string[];
}

export function AttendanceCalendar({ presentDates, absentDates, leaveDates }: Props) {
  return (
    <Calendar
      mode="multiple"
      modifiers={{
        present: presentDates.map(d => new Date(d)),
        absent: absentDates.map(d => new Date(d)),
        leave: leaveDates.map(d => new Date(d)),
      }}
      modifiersClassNames={{
        present: "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30",
        absent: "bg-red-500/20 text-red-700 hover:bg-red-500/30",
        leave: "bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30",
      }}
      className="pointer-events-none"
    />
  );
}
