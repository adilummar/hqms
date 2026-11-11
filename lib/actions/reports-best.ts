"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/helpers";
import {
  students, enrollments, classes, hifzDailyEntries, attendanceRecords,
  studentStars, parentMeetingAttendance, leaveActivityResponses,
  parents, users,
} from "@/lib/db/schema";
import { eq, and, between, isNull, inArray } from "drizzle-orm";
import { calculateAttendanceMetrics, DailyAttendance, SessionStatus } from "@/lib/utils/attendance-calculator";
import { aggregateStudyToJuz } from "@/lib/utils/juz-calculator";
import { getClassPerformance } from "@/lib/actions/reports";
import { getBestReportClasses } from "@/lib/reports/best-scope";

// ──────────────────────────────────────────────────────────────────────────────
// BEST STUDENT RAW METRICS
// NO ranking formula. Display raw Leave + Stars + Study per student.
// Ranking formula is a pending business decision and must NOT be invented here.
// ──────────────────────────────────────────────────────────────────────────────
export async function getAllStudentsRawMetrics(classId: string | null, startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin"]);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const studentMap: Map<string, { firstName: string; lastName: string | null; studentCode: string; className: string }> = new Map();
  let studentIds: string[];

  // Best Student considers ONLY the Hifz classes HA / HB / HC (enforced here, not in the UI).
  const scopeClasses = await getBestReportClasses();
  const scopeIds = scopeClasses.map(c => c.id);
  if (scopeIds.length === 0) return [];
  if (classId && !scopeIds.includes(classId)) return []; // a class outside the scope is never reported

  if (classId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, classId), eq(enrollments.status, "active")),
    });
    studentIds = classEnrollments.map(e => e.studentId);
    const cls = scopeClasses.find(c => c.id === classId);
    const studentsData = await db.query.students.findMany({
      where: and(inArray(students.id, studentIds), eq(students.status, "active")),
    });
    for (const s of studentsData) {
      studentMap.set(s.id, { firstName: s.firstName, lastName: s.lastName, studentCode: s.studentCode, className: cls?.name ?? "Unknown" });
    }
  } else {
    const allEnrollments = await db.query.enrollments.findMany({
      // Only enrolments in HA/HB/HC: a student's School / Madrasa class neither makes them
      // eligible nor becomes the class name shown for them.
      where: and(eq(enrollments.status, "active"), inArray(enrollments.classId, scopeIds)),
      with: { class: true },
    });
    studentIds = [...new Set(allEnrollments.map(e => e.studentId))];
    const studentsData = await db.query.students.findMany({
      where: and(inArray(students.id, studentIds), eq(students.status, "active")),
    });
    const enrollMap = new Map(allEnrollments.map(e => [e.studentId, e.class?.name ?? "Unknown"]));
    for (const s of studentsData) {
      studentMap.set(s.id, { firstName: s.firstName, lastName: s.lastName, studentCode: s.studentCode, className: enrollMap.get(s.id) ?? "Unknown" });
    }
  }

  if (studentIds.length === 0) return [];

  const [studyEntries, rawAttendance, starsData, holidayLeaves] = await Promise.all([
    db.query.hifzDailyEntries.findMany({
      where: and(inArray(hifzDailyEntries.studentId, studentIds), between(hifzDailyEntries.date, startStr, endStr)),
    }),
    db.query.attendanceRecords.findMany({
      where: and(inArray(attendanceRecords.studentId, studentIds), between(attendanceRecords.date, startStr, endStr), isNull(attendanceRecords.deletedAt)),
    }),
    db.query.studentStars.findMany({
      where: and(inArray(studentStars.studentId, studentIds), isNull(studentStars.deletedAt)),
    }),
    db.query.leaveActivityResponses.findMany({
      where: inArray(leaveActivityResponses.studentId, studentIds),
      with: { leavePeriod: { with: { days: true } } },
    }),
  ]);

  const results = studentIds.map(sid => {
    const info = studentMap.get(sid);
    if (!info) return null;

    const sEntries = studyEntries.filter(e => e.studentId === sid);
    const juzEquivalent = aggregateStudyToJuz(
      sEntries.filter(e => parseFloat(e.sabaqPages as any) > 0).map(e => ({ pages: parseFloat(e.sabaqPages as any), juzNumber: e.sabaqJuzNumber }))
    );

    const sAtt = rawAttendance.filter(r => r.studentId === sid);
    const attByDate = new Map<string, DailyAttendance>();
    for (const r of sAtt) {
      if (!attByDate.has(r.date)) attByDate.set(r.date, { fn: "unmarked", an: "unmarked" });
      const day = attByDate.get(r.date)!;
      if (r.session === "FN") day.fn = r.status as SessionStatus;
      if (r.session === "AN") day.an = r.status as SessionStatus;
    }
    const attMetrics = calculateAttendanceMetrics(Array.from(attByDate.values()));
    const schoolLeaveDates = new Set(sAtt.filter(r => r.status === "leave").map(r => r.date));
    const holidayLeaveCount = holidayLeaves.filter(h => {
      if (h.studentId !== sid || !h.completed) return false;
      const dayRow = h.leavePeriod.days.find(d => d.dayNumber === h.dayNumber);
      return dayRow && dayRow.date >= startStr && dayRow.date <= endStr;
    }).length;

    const sStars = starsData.filter(s => s.studentId === sid);
    // Blue and Black are STRICTLY independent — no net/combined score
    const blueStars = sStars.filter(s => s.type === "blue").reduce((acc, s) => acc + s.value, 0);
    const blackStars = sStars.filter(s => s.type === "black").reduce((acc, s) => acc + s.value, 0);

    return {
      studentId: sid,
      studentCode: info.studentCode,
      firstName: info.firstName,
      lastName: info.lastName,
      className: info.className,
      study: { juzEquivalent },
      attendance: { attendancePercentage: attMetrics.attendancePercentage },
      leave: { schoolLeaveDays: schoolLeaveDates.size, holidayTrackerCompleted: holidayLeaveCount },
      stars: { blue: blueStars, black: blackStars },
    };
  });

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ──────────────────────────────────────────────────────────────────────────────
// BEST CLASS RAW METRICS  (delegates to getClassPerformance per class)
// NO ranking formula.
// ──────────────────────────────────────────────────────────────────────────────
export async function getAllClassesRawMetrics(startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin"]);

  // Best Class compares ONLY the Hifz classes HA / HB / HC
  const allClasses = await getBestReportClasses();

  const results = await Promise.all(
    allClasses.map(async cls => {
      const report = await getClassPerformance(cls.id, startDate, endDate);
      if (!report) return null;
      return { classId: cls.id, className: cls.name, ...report };
    })
  );
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ──────────────────────────────────────────────────────────────────────────────
// BEST PARENT RAW METRICS
// NO ranking formula.
// ──────────────────────────────────────────────────────────────────────────────
export async function getAllParentsRawMetrics(startDate: Date, endDate: Date) {
  await requireRole(["admin", "super_admin", "school_admin", "madrasa_admin"]);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const parentProfiles = await db.query.parents.findMany({ with: { user: true, student: true } });
  const meetingAttendances = await db.query.parentMeetingAttendance.findMany({ with: { meeting: true } });
  const filteredMeetings = meetingAttendances.filter(m => m.meeting.meetingDate >= startStr && m.meeting.meetingDate <= endStr);

  return parentProfiles.map(p => {
    const meetings = filteredMeetings.filter(m => m.studentId === p.studentId);
    return {
      parentId: p.id,
      username: p.user?.username ?? "—",
      lastLoginAt: p.user?.lastLoginAt ?? null,
      linkedStudentName: `${p.student.firstName} ${p.student.lastName ?? ""}`,
      linkedStudentCode: p.student.studentCode,
      // Raw meeting metrics only — NO formula-based score
      parentMeeting: {
        onTime: meetings.filter(m => m.status === "ON_TIME").length,
        late: meetings.filter(m => m.status === "LATE").length,
        absentWithReason: meetings.filter(m => m.status === "ABSENT_WITH_REASON").length,
        absentWithoutReason: meetings.filter(m => m.status === "ABSENT_WITHOUT_VALID_REASON").length,
      },
    };
  });
}
