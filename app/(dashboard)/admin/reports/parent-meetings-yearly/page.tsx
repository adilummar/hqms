import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  academicYears,
  parentMeetings,
  parentMeetingAttendance,
  enrollments,
  students,
  classes,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, asc, between } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/reports/print-button";
import {
  YearlyParentMeetingReportClient,
  YearlyMeetingReportRow,
} from "@/components/meetings/yearly-parent-meeting-report-client";
import Link from "next/link";
import { CalendarDays, CheckCircle2, XCircle, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Yearly Parent Meeting Report | Admin" };

interface Props {
  searchParams: Promise<{ yearId?: string; classId?: string; track?: string }>;
}

export default async function YearlyParentMeetingReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  // ── Fetch Academic Years ──────────────────────────────────────────────────────
  const allYears = await db.query.academicYears.findMany({
    orderBy: [desc(academicYears.startDate)],
  });

  const currentYear = allYears.find((y) => y.isCurrent) ?? allYears[0];
  const selectedYearId = params.yearId ?? currentYear?.id;
  const selectedYear = allYears.find((y) => y.id === selectedYearId);

  // ── Fetch Classes for Filtering ───────────────────────────────────────────────
  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [asc(classes.name)],
  });

  const trackFilter = params.track ?? "all";
  const filteredClassesByTrack =
    trackFilter === "all" ? allClasses : allClasses.filter((c) => c.track === trackFilter);

  const selectedClassId = params.classId && params.classId !== "all" ? params.classId : null;

  // ── Fetch Meetings within Selected Year ───────────────────────────────────────
  let meetingsInYear: (typeof parentMeetings.$inferSelect)[] = [];
  if (selectedYear) {
    const startStr = selectedYear.startDate.toISOString().split("T")[0];
    const endStr = selectedYear.endDate.toISOString().split("T")[0];

    meetingsInYear = await db.query.parentMeetings.findMany({
      where: between(parentMeetings.meetingDate, startStr, endStr),
      orderBy: [asc(parentMeetings.meetingDate)],
    });
  }

  // ── Compile Attendance Data ───────────────────────────────────────────────────
  let rows: YearlyMeetingReportRow[] = [];
  let overallExpected = 0;
  let overallAttended = 0;

  if (selectedYear && filteredClassesByTrack.length > 0) {
    const targetClassIds = selectedClassId
      ? [selectedClassId]
      : filteredClassesByTrack.map((c) => c.id);

    if (targetClassIds.length > 0) {
      const classEnrollments = await db.query.enrollments.findMany({
        where: and(inArray(enrollments.classId, targetClassIds), eq(enrollments.status, "active")),
      });

      if (classEnrollments.length > 0) {
        const studentIds = [...new Set(classEnrollments.map((e) => e.studentId))];

        const studentClassMap = new Map<string, { className: string; classTrack: string }>();
        for (const enr of classEnrollments) {
          if (!studentClassMap.has(enr.studentId)) {
            const cls = allClasses.find((c) => c.id === enr.classId);
            if (cls) studentClassMap.set(enr.studentId, { className: cls.name, classTrack: cls.track });
          }
        }

        const studentsData = await db.query.students.findMany({
          where: and(eq(students.status, "active"), inArray(students.id, studentIds)),
          columns: { id: true, studentCode: true, firstName: true, lastName: true },
        });

        const meetingIds = meetingsInYear.map((m) => m.id);
        
        let attendanceData: (typeof parentMeetingAttendance.$inferSelect)[] = [];
        if (meetingIds.length > 0) {
          attendanceData = await db.query.parentMeetingAttendance.findMany({
            where: and(
              inArray(parentMeetingAttendance.meetingId, meetingIds),
              inArray(parentMeetingAttendance.studentId, studentIds)
            ),
          });
        }

        // Map attendance by student
        const attByStudent = new Map<string, typeof attendanceData>();
        for (const att of attendanceData) {
          if (!attByStudent.has(att.studentId)) attByStudent.set(att.studentId, []);
          attByStudent.get(att.studentId)!.push(att);
        }

        rows = studentsData.map((s) => {
          const studentAtt = attByStudent.get(s.id) || [];
          const cls = studentClassMap.get(s.id);
          
          let studentAttendedCount = 0;

          const attendanceDetails = meetingsInYear.map(meeting => {
            const record = studentAtt.find(a => a.meetingId === meeting.id);
            if (record?.attended) {
              studentAttendedCount++;
              overallAttended++;
            }
            if (record) overallExpected++;

            return {
              meetingId: meeting.id,
              meetingTitle: meeting.title,
              attended: record?.attended ?? false,
              remarks: record?.remarks ?? null,
            };
          });

          return {
            studentId: s.id,
            studentCode: s.studentCode,
            firstName: s.firstName,
            lastName: s.lastName,
            className: cls?.className ?? "Unknown",
            classTrack: cls?.classTrack ?? "unknown",
            totalAttended: studentAttendedCount,
            totalMeetings: meetingsInYear.length,
            attendanceDetails,
          };
        });
      }
    }
  }

  const overallRate = overallExpected > 0 ? Math.round((overallAttended / overallExpected) * 100) : 0;

  const trackOptions = [
    { value: "all", label: "All Tracks" },
    { value: "hifz", label: "Hifz" },
    { value: "madrasa", label: "Madrasa" },
    { value: "school", label: "School" },
  ];

  return (
    <div className="print:m-0 print:p-0">
      <div className="print:hidden">
        <PageHeader
          title="Yearly Parent Meeting Report"
          description="Consolidated attendance report across all meetings in an academic year"
          breadcrumbs={[
            { label: "Admin" },
            { label: "Reports", href: "/admin/reports" },
            { label: "Yearly Parent Meetings" },
          ]}
          action={<PrintButton />}
        />
      </div>

      <div className="hidden print:block mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider">HQMS</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">Yearly Parent Meeting Report</h1>
        {selectedYear && <p className="text-sm text-gray-600 mt-1">{selectedYear.label}</p>}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left Sidebar ── */}
        <div className="lg:w-68 shrink-0 space-y-4 print:hidden">
          {/* Year selector */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Academic Year</p>
            <div className="space-y-1.5">
              {allYears.map((y) => (
                <Link
                  key={y.id}
                  href={`/admin/reports/parent-meetings-yearly?yearId=${y.id}&track=${trackFilter}&classId=${selectedClassId ?? "all"}`}
                  className={`block px-3 py-2.5 border rounded-md text-sm transition-all ${
                    selectedYearId === y.id ? "border-foreground bg-foreground/5 font-medium text-foreground" : "border-border hover:border-foreground/40 text-muted-foreground"
                  }`}
                >
                  {y.label}
                  {y.isCurrent && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Current</span>}
                </Link>
              ))}
              {allYears.length === 0 && (
                <p className="text-sm text-muted-foreground">No academic years found</p>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filters</p>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Track</label>
              <div className="space-y-0.5">
                {trackOptions.map((t) => (
                  <Link
                    key={t.value}
                    href={`/admin/reports/parent-meetings-yearly?yearId=${selectedYearId ?? ""}&track=${t.value}&classId=all`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      trackFilter === t.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>

            {trackFilter !== "all" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Class</label>
                <div className="space-y-0.5">
                  <Link
                    href={`/admin/reports/parent-meetings-yearly?yearId=${selectedYearId ?? ""}&track=${trackFilter}&classId=all`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      !selectedClassId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    All Classes
                  </Link>
                  {filteredClassesByTrack.map((cls) => (
                    <Link
                      key={cls.id}
                      href={`/admin/reports/parent-meetings-yearly?yearId=${selectedYearId ?? ""}&track=${trackFilter}&classId=${cls.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedClassId === cls.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {cls.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          {!selectedYear ? (
            <div className="border border-border rounded-lg p-16 text-center text-muted-foreground text-sm">
              <CalendarDays size={28} className="mx-auto mb-3 opacity-40" />
              <p>Select an academic year to view the report</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* ── Overall Summary Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
                {[
                  { label: "Total Meetings in Year", value: meetingsInYear.length, icon: <CalendarDays size={16} />, color: "text-foreground", bg: "bg-card border-border" },
                  { label: "Total Students Evaluated", value: rows.length, icon: <Users size={16} />, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                  { label: "Total Attendances", value: overallAttended, icon: <CheckCircle2 size={16} />, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                  { label: "Overall Attend. Rate", value: `${overallRate}%`, icon: null, color: overallRate >= 75 ? "text-emerald-700" : overallRate >= 50 ? "text-amber-600" : "text-red-600", bg: "bg-card border-border" },
                ].map(({ label, value, icon, color, bg }) => (
                  <div key={label} className={`rounded-lg border px-4 py-3 ${bg}`}>
                    {icon && <div className={`${color} mb-1 opacity-70`}>{icon}</div>}
                    <p className={`font-playfair text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* ── Detailed Table ── */}
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  {selectedClassId
                    ? `${allClasses.find(c => c.id === selectedClassId)?.name} — Yearly Attendance`
                    : "All Students — Yearly Attendance"}
                </h3>
                
                {meetingsInYear.length === 0 ? (
                  <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                    <p className="font-medium">No parent meetings were found for this academic year.</p>
                  </div>
                ) : (
                  <YearlyParentMeetingReportClient
                    rows={rows}
                    totalMeetings={meetingsInYear.length}
                    yearLabel={selectedYear.label}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
