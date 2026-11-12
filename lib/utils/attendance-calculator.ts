/**
 * attendance-calculator.ts
 * 
 * Rules:
 * FN Present + AN Present = FULL DAY PRESENT
 * FN Present + AN Absent = HALF DAY PRESENT
 * FN Absent + AN Present = HALF DAY PRESENT
 * FN Absent + AN Absent = FULL DAY ABSENT
 * If either session is UNMARKED = PENDING / PARTIAL RECORD
 * Both Unmarked = NO ATTENDANCE RECORDED
 * 
 * Percentage = Present Sessions / (Present Sessions + Absent Sessions) * 100
 */

import { collapseOffSessions } from "@/lib/attendance/status";

// "friday" / "holiday" = off-day sessions: not worked, so never present/absent/unmarked and
// excluded from the percentage. A day with one off session is judged by the other session.
export type SessionStatus = "present" | "absent" | "unmarked" | "friday" | "holiday";

export interface DailyAttendance {
  fn: SessionStatus;
  an: SessionStatus;
}

export type DailyOutcome = 
  | "FULL_DAY_PRESENT" 
  | "HALF_DAY_PRESENT" 
  | "FULL_DAY_ABSENT" 
  | "PENDING_PARTIAL" 
  | "NO_RECORD"
  | "OFF_DAY";

export function getDailyAttendanceOutcome(fnIn: SessionStatus, anIn: SessionStatus): DailyOutcome {
  const { fn, an, offDay } = collapseOffSessions(fnIn, anIn);
  if (offDay) return "OFF_DAY";
  // One session off + the worked session not marked yet = partly recorded, not "no record"
  if (fn === "unmarked" && an === "unmarked") return fnIn !== anIn ? "PENDING_PARTIAL" : "NO_RECORD";
  if (fn === "unmarked" || an === "unmarked") return "PENDING_PARTIAL";
  
  if (fn === "present" && an === "present") return "FULL_DAY_PRESENT";
  if (fn === "absent" && an === "absent") return "FULL_DAY_ABSENT";
  
  return "HALF_DAY_PRESENT";
}

export interface AttendanceMetrics {
  fullDaysPresent: number;
  halfDaysPresent: number;
  fullDaysAbsent: number;
  presentSessions: number;
  absentSessions: number;
  unmarkedSessions: number;
  attendancePercentage: number;
}

/**
 * Summarizes an array of daily session records (already paired by day)
 */
export function calculateAttendanceMetrics(days: DailyAttendance[]): AttendanceMetrics {
  let fullDaysPresent = 0;
  let halfDaysPresent = 0;
  let fullDaysAbsent = 0;
  
  let presentSessions = 0;
  let absentSessions = 0;
  let unmarkedSessions = 0;

  for (const day of days) {
    const outcome = getDailyAttendanceOutcome(day.fn, day.an);
    // Off-day sessions are skipped entirely below (neither present, absent nor unmarked)
    if (outcome === "FULL_DAY_PRESENT") fullDaysPresent++;
    if (outcome === "HALF_DAY_PRESENT") halfDaysPresent++;
    if (outcome === "FULL_DAY_ABSENT") fullDaysAbsent++;

    if (day.fn === "present") presentSessions++;
    if (day.fn === "absent") absentSessions++;
    if (day.fn === "unmarked") unmarkedSessions++;

    if (day.an === "present") presentSessions++;
    if (day.an === "absent") absentSessions++;
    if (day.an === "unmarked") unmarkedSessions++;
  }

  const denominator = presentSessions + absentSessions;
  const attendancePercentage = denominator > 0 ? (presentSessions / denominator) * 100 : 0;

  return {
    fullDaysPresent,
    halfDaysPresent,
    fullDaysAbsent,
    presentSessions,
    absentSessions,
    unmarkedSessions,
    attendancePercentage
  };
}
