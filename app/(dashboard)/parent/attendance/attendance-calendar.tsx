"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  presentDates: string[];
  absentDates: string[];
  leaveDates: string[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AttendanceCalendar({ presentDates, absentDates, leaveDates }: Props) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [hovered, setHovered] = useState<string | null>(null);

  const presentSet = new Set(presentDates);
  const absentSet  = new Set(absentDates);
  const leaveSet   = new Set(leaveDates);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // First day weekday offset + days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  // Days from previous month to pad
  const daysInPrev      = new Date(year, month, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Build grid cells
  const cells: { date: Date | null; key: string | null; isCurrentMonth: boolean }[] = [];

  // Leading days from prev month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrev - i);
    cells.push({ date: d, key: toKey(d), isCurrentMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, key: toKey(date), isCurrentMonth: true });
  }
  // Trailing days to complete last row
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const date = new Date(year, month + 1, d);
    cells.push({ date, key: toKey(date), isCurrentMonth: false });
  }

  function getStatus(key: string | null) {
    if (!key) return null;
    if (presentSet.has(key)) return "present";
    if (absentSet.has(key))  return "absent";
    if (leaveSet.has(key))   return "leave";
    return null;
  }

  function cellStyle(key: string | null, isCurrentMonth: boolean) {
    const status = getStatus(key);
    const isToday = key === toKey(today);
    const isHov   = key === hovered;

    let bg    = "bg-transparent";
    let text  = isCurrentMonth ? "text-foreground" : "text-muted-foreground/40";
    let ring  = "";
    let font  = "font-normal";

    if (status === "present") {
      bg   = "bg-emerald-500/15";
      text = isCurrentMonth ? "text-emerald-700" : "text-emerald-400/50";
      font = "font-semibold";
    } else if (status === "absent") {
      bg   = "bg-red-500/15";
      text = isCurrentMonth ? "text-red-700" : "text-red-400/50";
      font = "font-semibold";
    } else if (status === "leave") {
      bg   = "bg-amber-400/15";
      text = isCurrentMonth ? "text-amber-700" : "text-amber-400/50";
      font = "font-semibold";
    }

    if (isToday) ring = "ring-2 ring-teal ring-offset-1";
    if (isHov && status)  bg = status === "present" ? "bg-emerald-500/25" : status === "absent" ? "bg-red-500/25" : "bg-amber-400/25";

    return `${bg} ${text} ${ring} ${font}`;
  }

  const statusLabel: Record<string, string> = {
    present: "Present",
    absent:  "Absent",
    leave:   "Leave",
  };

  const statusColor: Record<string, string> = {
    present: "bg-emerald-500 text-white",
    absent:  "bg-red-500 text-white",
    leave:   "bg-amber-500 text-white",
  };

  // Count for this displayed month
  let mPresent = 0, mAbsent = 0, mLeave = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = toKey(new Date(year, month, d));
    if (presentSet.has(k)) mPresent++;
    else if (absentSet.has(k)) mAbsent++;
    else if (leaveSet.has(k)) mLeave++;
  }

  return (
    <div className="w-full select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground font-inter">
            {MONTHS[month]} {year}
          </h3>
          <p className="text-xs text-muted-foreground font-dm-sans mt-0.5">
            {mPresent} present · {mAbsent} absent · {mLeave} leave
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground font-dm-sans"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide py-2 font-inter">
            {d}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-2" />

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((cell, idx) => {
          const status = getStatus(cell.key);
          const isToday = cell.key === toKey(today);

          return (
            <div
              key={idx}
              className="relative flex items-center justify-center"
              onMouseEnter={() => cell.isCurrentMonth && cell.key ? setHovered(cell.key) : undefined}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={`
                  relative w-full aspect-square max-w-[52px] mx-auto
                  flex flex-col items-center justify-center
                  rounded-xl transition-all duration-150 cursor-default
                  ${cellStyle(cell.key, cell.isCurrentMonth)}
                `}
              >
                {/* Today ring label */}
                {isToday && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-teal" />
                )}

                <span className={`text-[13px] leading-none ${isToday ? "font-bold" : ""}`}>
                  {cell.date?.getDate()}
                </span>

                {/* Status dot */}
                {status && cell.isCurrentMonth && (
                  <span className={`
                    mt-1 w-1.5 h-1.5 rounded-full
                    ${status === "present" ? "bg-emerald-500" :
                      status === "absent"  ? "bg-red-500" :
                                             "bg-amber-500"}
                  `} />
                )}

                {/* Hover tooltip */}
                {hovered === cell.key && status && cell.isCurrentMonth && (
                  <div className={`
                    absolute -top-9 left-1/2 -translate-x-1/2 z-20
                    px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap
                    shadow-lg pointer-events-none
                    ${statusColor[status]}
                  `}>
                    {statusLabel[status]}
                    <div className={`
                      absolute -bottom-1 left-1/2 -translate-x-1/2
                      w-2 h-2 rotate-45
                      ${status === "present" ? "bg-emerald-500" :
                        status === "absent"  ? "bg-red-500" :
                                               "bg-amber-500"}
                    `} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-5 pt-4 border-t border-border justify-center flex-wrap">
        {[
          { label: "Present", color: "bg-emerald-500", light: "bg-emerald-500/15 text-emerald-700" },
          { label: "Absent",  color: "bg-red-500",     light: "bg-red-500/15 text-red-700" },
          { label: "Leave",   color: "bg-amber-500",   light: "bg-amber-400/15 text-amber-700" },
          { label: "Today",   color: "bg-teal",        light: "" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-xs text-muted-foreground font-dm-sans">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
