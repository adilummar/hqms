"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/helpers";
import { 
  students, enrollments, classes, hifzDailyEntries, attendanceRecords, 
  studentStars, parentMeetingAttendance, leaveActivityResponses,
  users, parents
} from "@/lib/db/schema";
import { eq, and, between, isNull, inArray } from "drizzle-orm";
import { calculateAttendanceMetrics, DailyAttendance, SessionStatus } from "@/lib/utils/attendance-calculator";
import { aggregateStudyToJuz, formatJuzEquivalent } from "@/lib/utils/juz-calculator";

export async function getStudentPerformance(studentId: string, startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin", "tutor"]);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const studyEntries = await db.query.hifzDailyEntries.findMany({
    where: and(
      eq(hifzDailyEntries.studentId, studentId),
      between(hifzDailyEntries.date, startStr, endStr)
    )
  });

  const totalSabaqPages = studyEntries.reduce((acc, e) => acc + (parseFloat(e.sabaqPages as any) || 0), 0);
  const sabaqNotGiven = studyEntries.filter(e => e.sabaqJuzGiven === false).length; 
  
  const studyInputs = studyEntries.filter(e => parseFloat(e.sabaqPages as any) > 0).map(e => ({
    pages: parseFloat(e.sabaqPages as any),
    juzNumber: e.sabaqJuzNumber
  }));
  const juzEquivalent = aggregateStudyToJuz(studyInputs);

  const rawAttendance = await db.query.attendanceRecords.findMany({
    where: and(
      eq(attendanceRecords.studentId, studentId),
      between(attendanceRecords.date, startStr, endStr),
      isNull(attendanceRecords.deletedAt)
    )
  });

  const attByDate = new Map<string, DailyAttendance>();
  for (const r of rawAttendance) {
    if (!attByDate.has(r.date)) {
      attByDate.set(r.date, { fn: "unmarked", an: "unmarked" });
    }
    const day = attByDate.get(r.date)!;
    if (r.session === "FN") day.fn = r.status as SessionStatus;
    if (r.session === "AN") day.an = r.status as SessionStatus;
  }
  const attendanceMetrics = calculateAttendanceMetrics(Array.from(attByDate.values()));

  const schoolLeaveDates = new Set(rawAttendance.filter(r => r.status === "leave").map(r => r.date));

  // leaveActivityResponses has leavePeriodId + dayNumber. Date lives in leavePeriodDays.
  // We fetch via leavePeriod and its days to get the date for range filtering.
  const holidayLeaves = await db.query.leaveActivityResponses.findMany({
    where: eq(leaveActivityResponses.studentId, studentId),
    with: { leavePeriod: { with: { days: true } } }
  });
  const filteredHolidayLeaves = holidayLeaves.filter(h => {
    const dayRow = h.leavePeriod.days.find(d => d.dayNumber === h.dayNumber);
    return dayRow && dayRow.date >= startStr && dayRow.date <= endStr;
  });
  const holidayLeaveCount = filteredHolidayLeaves.filter(h => h.completed).length;

  const stars = await db.query.studentStars.findMany({
    where: and(
      eq(studentStars.studentId, studentId),
      between(studentStars.awardedAt as any, startDate, endDate),
      isNull(studentStars.deletedAt)
    )
  });
  const blueStars = stars.filter(s => s.type === "blue").reduce((acc, s) => acc + s.value, 0);
  const blackStars = stars.filter(s => s.type === "black").reduce((acc, s) => acc + s.value, 0);

  const meetings = await db.query.parentMeetingAttendance.findMany({
    where: eq(parentMeetingAttendance.studentId, studentId),
    with: { meeting: true }
  });
  const filteredMeetings = meetings.filter(m => m.meeting.meetingDate >= startStr && m.meeting.meetingDate <= endStr);
  
  const parentMeeting = {
    onTime: filteredMeetings.filter(m => m.status === "ON_TIME").length,
    late: filteredMeetings.filter(m => m.status === "LATE").length,
    absentWithReason: filteredMeetings.filter(m => m.status === "ABSENT_WITH_REASON").length,
    absentWithoutReason: filteredMeetings.filter(m => m.status === "ABSENT_WITHOUT_VALID_REASON").length,
  };

  return {
    study: { totalSabaqPages, juzEquivalent, sabaqNotGiven },
    attendance: attendanceMetrics,
    leave: { schoolLeaveDays: schoolLeaveDates.size, holidayTrackerCompleted: holidayLeaveCount },
    stars: { blue: blueStars, black: blackStars },
    parentMeeting
  };
}

export async function getClassPerformance(classId: string, startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin"]);

  const classEnrollments = await db.query.enrollments.findMany({
    where: and(eq(enrollments.classId, classId), eq(enrollments.status, "active"))
  });

  const studentIds = classEnrollments.map(e => e.studentId);
  if (studentIds.length === 0) return null;
  
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const studyEntries = await db.query.hifzDailyEntries.findMany({
    where: and(inArray(hifzDailyEntries.studentId, studentIds), between(hifzDailyEntries.date, startStr, endStr))
  });
  
  const studyInputs = studyEntries.filter(e => parseFloat(e.sabaqPages as any) > 0).map(e => ({
    pages: parseFloat(e.sabaqPages as any),
    juzNumber: e.sabaqJuzNumber
  }));
  const totalJuzEquivalent = aggregateStudyToJuz(studyInputs);

  const rawAttendance = await db.query.attendanceRecords.findMany({
    where: and(inArray(attendanceRecords.studentId, studentIds), between(attendanceRecords.date, startStr, endStr), isNull(attendanceRecords.deletedAt))
  });

  const attByStudentDate = new Map<string, DailyAttendance>();
  for (const r of rawAttendance) {
    const key = `${r.studentId}_${r.date}`;
    if (!attByStudentDate.has(key)) attByStudentDate.set(key, { fn: "unmarked", an: "unmarked" });
    const day = attByStudentDate.get(key)!;
    if (r.session === "FN") day.fn = r.status as SessionStatus;
    if (r.session === "AN") day.an = r.status as SessionStatus;
  }
  const attendanceMetrics = calculateAttendanceMetrics(Array.from(attByStudentDate.values()));

  const schoolLeaveDates = new Set(rawAttendance.filter(r => r.status === "leave").map(r => `${r.studentId}_${r.date}`));
  
  const holidayLeaves = await db.query.leaveActivityResponses.findMany({
    where: inArray(leaveActivityResponses.studentId, studentIds),
    with: { leavePeriod: { with: { days: true } } }
  });
  const filteredHolidayLeaves = holidayLeaves.filter(h => {
    const dayRow = h.leavePeriod.days.find(d => d.dayNumber === h.dayNumber);
    return dayRow && dayRow.date >= startStr && dayRow.date <= endStr;
  });
  const holidayLeaveCount = filteredHolidayLeaves.filter(h => h.completed).length;

  const stars = await db.query.studentStars.findMany({
    where: and(inArray(studentStars.studentId, studentIds), between(studentStars.awardedAt as any, startDate, endDate), isNull(studentStars.deletedAt))
  });
  const blueStars = stars.filter(s => s.type === "blue").reduce((acc, s) => acc + s.value, 0);
  const blackStars = stars.filter(s => s.type === "black").reduce((acc, s) => acc + s.value, 0);

  const meetings = await db.query.parentMeetingAttendance.findMany({
    where: inArray(parentMeetingAttendance.studentId, studentIds),
    with: { meeting: true }
  });
  const filteredMeetings = meetings.filter(m => m.meeting.meetingDate >= startStr && m.meeting.meetingDate <= endStr);
  const onTime = filteredMeetings.filter(m => m.status === "ON_TIME").length;
  const late = filteredMeetings.filter(m => m.status === "LATE").length;
  const absentWithReason = filteredMeetings.filter(m => m.status === "ABSENT_WITH_REASON").length;
  const absentWithoutReason = filteredMeetings.filter(m => m.status === "ABSENT_WITHOUT_VALID_REASON").length;

  return {
    studentCount: studentIds.length,
    study: {
      totalJuzEquivalent,
      avgJuzPerStudent: totalJuzEquivalent / studentIds.length
    },
    attendance: attendanceMetrics,
    leave: { schoolLeaveDays: schoolLeaveDates.size, holidayTrackerCompleted: holidayLeaveCount },
    stars: { blue: blueStars, black: blackStars },
    parentMeeting: { onTime, late, absentWithReason, absentWithoutReason }
  };
}

export async function getStudyProgress(studentId: string, startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin", "tutor"]);
  
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const studyEntries = await db.query.hifzDailyEntries.findMany({
    where: and(
      eq(hifzDailyEntries.studentId, studentId),
      between(hifzDailyEntries.date, startStr, endStr)
    ),
    orderBy: (entries, { asc }) => [asc(entries.date)]
  });

  const dailyProgress = studyEntries.filter(e => parseFloat(e.sabaqPages as any) > 0).map(e => {
    const pages = parseFloat(e.sabaqPages as any);
    return {
      date: e.date,
      pages,
      juzNumber: e.sabaqJuzNumber,
      juzFormatted: formatJuzEquivalent(pages, e.sabaqJuzNumber)
    };
  });

  const totalJuzEquivalent = aggregateStudyToJuz(dailyProgress.map(d => ({ pages: d.pages, juzNumber: d.juzNumber })));
  const totalPages = dailyProgress.reduce((acc, d) => acc + d.pages, 0);

  return { dailyProgress, totalJuzEquivalent, totalPages };
}


export async function getParentEngagement(startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin"]);
  
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const parentUsers = await db.query.users.findMany({
    where: eq(users.role, "parent"),
  });

  const parentProfiles = await db.query.parents.findMany({
    with: { student: true }
  });

  // Not many activityLogs will exist because auth.ts does not log them, but lastLoginAt does
  // We will map this for the report.
  const engagement = parentUsers.map(u => {
    const profile = parentProfiles.find(p => p.userId === u.id);
    return {
      userId: u.id,
      username: u.username,
      lastLoginAt: u.lastLoginAt,
      linkedStudentName: profile ? `${profile.student.firstName} ${profile.student.lastName ?? ""}` : "Unlinked",
      linkedStudentCode: profile ? profile.student.studentCode : ""
    };
  });

  // Sort by most recently active
  engagement.sort((a, b) => {
    if (!a.lastLoginAt && !b.lastLoginAt) return 0;
    if (!a.lastLoginAt) return 1;
    if (!b.lastLoginAt) return -1;
    return b.lastLoginAt.getTime() - a.lastLoginAt.getTime();
  });

  return engagement;
}

