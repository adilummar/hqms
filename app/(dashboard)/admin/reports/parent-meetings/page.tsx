import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  parentMeetings,
  parentMeetingAttendance,
  enrollments,
  students,
  classes,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/reports/print-button";
import {
  ParentMeetingReportClient,
  MeetingReportRow,
} from "@/components/meetings/parent-meeting-report-client";
import Link from "next/link";
import { CalendarDays, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parent Meeting Report | Admin" };

interface Props {
  searchParams: Promise<{ meetingId?: string; classId?: string; track?: string }>;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ParentMeetingReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];

  // ── All meetings ──────────────────────────────────────────────────────────────
  const allMeetings = await db.query.parentMeetings.findMany({
    orderBy: [desc(parentMeetings.meetingDate)],
  });

  const upcoming = allMeetings.filter((m) => m.meetingDate >= today);
  const past = allMeetings.filter((m) => m.meetingDate < today);
  const sortedMeetings = [...upcoming, ...past];

  const selectedMeetingId = params.meetingId ?? sortedMeetings[0]?.id;
  const selectedMeeting = sortedMeetings.find((m) => m.id === selectedMeetingId);

  // ── All active classes ────────────────────────────────────────────────────────
  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [asc(classes.name)],
  });

  const trackFilter = params.track ?? "all";
  const filteredClassesByTrack =
    trackFilter === "all" ? allClasses : allClasses.filter((c) => c.track === trackFilter);

  const selectedClassId = params.classId && params.classId !== "all" ? params.classId : null;

  // ── Fetch all attendance for selected meeting ─────────────────────────────────
  const allAttendance = selectedMeeting
    ? await db.query.parentMeetingAttendance.findMany({
        where: eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
      })
    : [];

  // ── Per-class stats (for the class breakdown view) ────────────────────────────
  // For each class, get enrolled students and cross-reference with attendance
  type ClassStat = {
    classId: string;
    className: string;
    track: string;
    total: number;
    attended: number;
    absent: number;
    notRecorded: number;
  };

  let classStats: ClassStat[] = [];

  if (selectedMeeting && filteredClassesByTrack.length > 0) {
    const attMap = new Map(allAttendance.map((a) => [a.studentId, a]));

    // Fetch ALL enrollments in one query (avoids per-class Promise.all → ECONNRESET)
    const allClassIds = filteredClassesByTrack.map((c) => c.id);
    const allEnrollments = await db.query.enrollments.findMany({
      where: and(inArray(enrollments.classId, allClassIds), eq(enrollments.status, "active")),
      columns: { classId: true, studentId: true },
    });

    // Group by classId in memory
    const enrollsByClass = new Map<string, string[]>();
    for (const enr of allEnrollments) {
      if (!enrollsByClass.has(enr.classId)) enrollsByClass.set(enr.classId, []);
      enrollsByClass.get(enr.classId)!.push(enr.studentId);
    }

    classStats = filteredClassesByTrack
      .map((cls) => {
        const studentIds = enrollsByClass.get(cls.id) ?? [];
        const total = studentIds.length;
        const attended = studentIds.filter((sid) => attMap.get(sid)?.attended === true).length;
        const absent = studentIds.filter((sid) => attMap.get(sid)?.attended === false).length;
        const notRecorded = total - attended - absent;
        return { classId: cls.id, className: cls.name, track: cls.track, total, attended, absent, notRecorded };
      })
      .filter((s) => s.total > 0);
  }

  // ── Rows for the detail table ─────────────────────────────────────────────────
  let rows: MeetingReportRow[] = [];

  if (selectedMeeting) {
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

        // Sequential queries — avoids ECONNRESET on Supabase connection pool
        const studentsData = await db.query.students.findMany({
          where: and(eq(students.status, "active"), inArray(students.id, studentIds)),
          columns: { id: true, studentCode: true, firstName: true, lastName: true },
        });

        const attendanceData = await db.query.parentMeetingAttendance.findMany({
          where: and(
            eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
            inArray(parentMeetingAttendance.studentId, studentIds)
          ),
        });

        const attMap = new Map(attendanceData.map((a) => [a.studentId, a]));

        // Include ALL students (not just those with recorded attendance)
        rows = studentsData
          .sort((a, b) => a.firstName.localeCompare(b.firstName))
          .map((s) => {
            const att = attMap.get(s.id);
            const cls = studentClassMap.get(s.id);
            return {
              studentId: s.id,
              studentCode: s.studentCode,
              firstName: s.firstName,
              lastName: s.lastName,
              className: cls?.className ?? "Unknown",
              classTrack: cls?.classTrack ?? "unknown",
              attended: att?.attended ?? false,
              remarks: att?.remarks ?? (att ? null : "Not recorded"),
            };
          });
      }
    }
  }

  const overallTotal = allAttendance.length;
  const overallAttended = allAttendance.filter((a) => a.attended).length;
  const overallRate = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0;

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
          title="Parent Meeting Report"
          description="Full attendance breakdown — who came and who didn't, by class"
          breadcrumbs={[
            { label: "Admin" },
            { label: "Reports", href: "/admin/reports" },
            { label: "Parent Meetings" },
          ]}
          action={<PrintButton />}
        />
      </div>

      <div className="hidden print:block mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider">HQMS</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">Parent Meeting Report</h1>
      </div>

      {allMeetings.length === 0 ? (
        <div className="border border-border rounded-lg p-16 text-center text-muted-foreground">
          <CalendarDays size={36} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No meetings scheduled yet</p>
          <p className="text-xs mt-2">
            Schedule parent meetings via{" "}
            <Link href="/admin/settings/parent-meetings" className="underline underline-offset-2 hover:text-foreground">
              Settings → Parent Meetings
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left Sidebar ── */}
          <div className="lg:w-68 shrink-0 space-y-4 print:hidden">

            {/* Filters */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filters</p>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Track</label>
                <div className="space-y-0.5">
                  {trackOptions.map((t) => (
                    <Link
                      key={t.value}
                      href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId ?? ""}&track=${t.value}&classId=all`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        trackFilter === t.value
                          ? "bg-foreground text-background"
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
                      href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId ?? ""}&track=${trackFilter}&classId=all`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        !selectedClassId ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      All Classes
                    </Link>
                    {filteredClassesByTrack.map((cls) => (
                      <Link
                        key={cls.id}
                        href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId ?? ""}&track=${trackFilter}&classId=${cls.id}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedClassId === cls.id
                            ? "bg-foreground text-background"
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

            {/* Meeting selector */}
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Select Meeting</p>
              <div className="space-y-1.5">
                {upcoming.length > 0 && (
                  <p className="text-xs text-amber-600 font-semibold px-1 flex items-center gap-1"><Clock size={10} />Upcoming</p>
                )}
                {upcoming.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/reports/parent-meetings?meetingId=${m.id}&track=${trackFilter}&classId=${selectedClassId ?? "all"}`}
                    className={`block px-3 py-2.5 border rounded-md text-sm transition-all ${
                      selectedMeetingId === m.id ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.meetingDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </Link>
                ))}
                {past.length > 0 && <p className="text-xs text-muted-foreground font-semibold px-1 pt-1">Past</p>}
                {past.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/reports/parent-meetings?meetingId=${m.id}&track=${trackFilter}&classId=${selectedClassId ?? "all"}`}
                    className={`block px-3 py-2.5 border rounded-md text-sm transition-all ${
                      selectedMeetingId === m.id ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/40 opacity-70"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.meetingDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div className="flex-1 min-w-0">
            {!selectedMeeting ? (
              <div className="border border-border rounded-lg p-16 text-center text-muted-foreground text-sm">
                <CalendarDays size={28} className="mx-auto mb-3 opacity-40" />
                <p>Select a meeting to view its report</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Meeting title */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-playfair text-xl font-semibold">{selectedMeeting.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{formatDate(selectedMeeting.meetingDate)}</p>
                    {selectedMeeting.description && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{selectedMeeting.description}</p>
                    )}
                  </div>
                  <Link
                    href={`/admin/parent-meetings?meetingId=${selectedMeetingId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded hover:bg-muted transition-colors print:hidden"
                  >
                    ✏️ Mark Attendance
                  </Link>
                </div>

                {/* ── Overall Summary Cards ── */}
                {overallTotal > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
                    {[
                      { label: "Total Recorded", value: overallTotal, icon: <Users size={16} />, color: "text-foreground", bg: "bg-card border-border" },
                      { label: "Parents Came", value: overallAttended, icon: <CheckCircle2 size={16} />, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                      { label: "Parents Absent", value: overallTotal - overallAttended, icon: <XCircle size={16} />, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                      { label: "Attendance Rate", value: `${overallRate}%`, icon: null, color: overallRate >= 75 ? "text-emerald-700" : overallRate >= 50 ? "text-amber-600" : "text-red-600", bg: "bg-card border-border" },
                    ].map(({ label, value, icon, color, bg }) => (
                      <div key={label} className={`rounded-lg border px-4 py-3 ${bg}`}>
                        {icon && <div className={`${color} mb-1 opacity-70`}>{icon}</div>}
                        <p className={`font-playfair text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Class-by-Class Breakdown ── */}
                {classStats.length > 0 && !selectedClassId && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden print:hidden">
                    <div className="px-5 py-3 border-b border-border bg-muted/30">
                      <h3 className="text-sm font-semibold">Class-by-Class Breakdown</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Who came and who didn't, per class</p>
                    </div>
                    <div className="divide-y divide-border">
                      {classStats.map((stat) => {
                        const recordedRate = stat.total > 0
                          ? Math.round(((stat.attended + stat.absent) / stat.total) * 100)
                          : 0;
                        const attendRate = (stat.attended + stat.absent) > 0
                          ? Math.round((stat.attended / (stat.attended + stat.absent)) * 100)
                          : 0;

                        return (
                          <div key={stat.classId} className="px-5 py-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{stat.className}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                                  stat.track === "school" ? "bg-blue-100 text-blue-700" :
                                  stat.track === "madrasa" ? "bg-emerald-100 text-emerald-700" :
                                  "bg-purple-100 text-purple-700"
                                }`}>{stat.track}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                                  <CheckCircle2 size={12} /> {stat.attended} came
                                </span>
                                <span className="flex items-center gap-1 text-red-600 font-semibold">
                                  <XCircle size={12} /> {stat.absent} absent
                                </span>
                                {stat.notRecorded > 0 && (
                                  <span className="text-amber-600 font-semibold">{stat.notRecorded} not recorded</span>
                                )}
                              </div>
                            </div>

                            {/* Stacked bar */}
                            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${stat.total > 0 ? (stat.attended / stat.total) * 100 : 0}%` }}
                                title={`${stat.attended} attended`}
                              />
                              <div
                                className="h-full bg-red-400 transition-all"
                                style={{ width: `${stat.total > 0 ? (stat.absent / stat.total) * 100 : 0}%` }}
                                title={`${stat.absent} absent`}
                              />
                              <div
                                className="h-full bg-amber-300 transition-all"
                                style={{ width: `${stat.total > 0 ? (stat.notRecorded / stat.total) * 100 : 0}%` }}
                                title={`${stat.notRecorded} not recorded`}
                              />
                            </div>

                            <div className="flex justify-between mt-1">
                              <p className="text-xs text-muted-foreground">{stat.total} students total</p>
                              {(stat.attended + stat.absent) > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {attendRate}% of recorded parents attended
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Attended</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Absent</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block" />Not Recorded</span>
                    </div>
                  </div>
                )}

                {/* ── Detailed Table ── */}
                {rows.length === 0 && overallTotal === 0 ? (
                  <div className="border border-border rounded-lg p-16 text-center text-muted-foreground">
                    <CalendarDays size={28} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No attendance recorded yet</p>
                    <p className="text-xs mt-1">
                      Attendance can be marked via{" "}
                      <Link href={`/admin/parent-meetings?meetingId=${selectedMeetingId}`} className="underline underline-offset-2 hover:text-foreground">
                        Parent Meetings
                      </Link>.
                    </p>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                    <p className="font-medium">No data for selected filters</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">
                      {selectedClassId
                        ? `${allClasses.find(c => c.id === selectedClassId)?.name} — Student Detail`
                        : "All Students Detail"}
                    </h3>
                    <ParentMeetingReportClient
                      meeting={{
                        id: selectedMeeting.id,
                        title: selectedMeeting.title,
                        meetingDate: selectedMeeting.meetingDate,
                        description: selectedMeeting.description,
                      }}
                      rows={rows}
                      allClasses={allClasses.map((c) => ({ id: c.id, name: c.name, track: c.track }))}
                      selectedClassId={selectedClassId}
                      formattedDate={formatDate(selectedMeeting.meetingDate)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
