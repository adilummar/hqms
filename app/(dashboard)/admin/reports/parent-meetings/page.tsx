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
import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Meeting Report | Admin",
};

interface Props {
  searchParams: Promise<{
    meetingId?: string;
    classId?: string;
    track?: string;
  }>;
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

  // ── 1. All meetings (newest first) ──────────────────────────────────────────
  const allMeetings = await db.query.parentMeetings.findMany({
    orderBy: [desc(parentMeetings.meetingDate)],
  });

  const upcoming = allMeetings.filter((m) => m.meetingDate >= today);
  const past = allMeetings.filter((m) => m.meetingDate < today);
  const sortedMeetings = [...upcoming, ...past];

  const selectedMeetingId = params.meetingId ?? sortedMeetings[0]?.id;
  const selectedMeeting = sortedMeetings.find((m) => m.id === selectedMeetingId);

  // ── 2. All active classes ────────────────────────────────────────────────────
  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [asc(classes.name)],
  });

  // Track filter
  const trackFilter = params.track ?? "all";
  const filteredClassesByTrack =
    trackFilter === "all"
      ? allClasses
      : allClasses.filter((c) => c.track === trackFilter);

  // Class filter — "all" means all classes for the track
  const selectedClassId =
    params.classId && params.classId !== "all" ? params.classId : null;

  // ── 3. Fetch attendance data ─────────────────────────────────────────────────
  let rows: MeetingReportRow[] = [];

  if (selectedMeeting) {
    // Determine which class IDs to include
    const targetClassIds = selectedClassId
      ? [selectedClassId]
      : filteredClassesByTrack.map((c) => c.id);

    if (targetClassIds.length > 0) {
      // Fetch all enrollments for those classes
      const classEnrollments = await db.query.enrollments.findMany({
        where: and(
          inArray(enrollments.classId, targetClassIds),
          eq(enrollments.status, "active")
        ),
      });

      if (classEnrollments.length > 0) {
        const studentIds = [...new Set(classEnrollments.map((e) => e.studentId))];

        // Build a studentId → className map (use the first enrollment if multiple)
        const studentClassMap = new Map<string, { className: string; classTrack: string }>();
        for (const enr of classEnrollments) {
          if (!studentClassMap.has(enr.studentId)) {
            const cls = allClasses.find((c) => c.id === enr.classId);
            if (cls) {
              studentClassMap.set(enr.studentId, {
                className: cls.name,
                classTrack: cls.track,
              });
            }
          }
        }

        const [studentsData, attendanceData] = await Promise.all([
          db.query.students.findMany({
            where: and(
              eq(students.status, "active"),
              inArray(students.id, studentIds)
            ),
            columns: {
              id: true,
              studentCode: true,
              firstName: true,
              lastName: true,
            },
          }),
          db.query.parentMeetingAttendance.findMany({
            where: and(
              eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
              inArray(parentMeetingAttendance.studentId, studentIds)
            ),
          }),
        ]);

        const attMap = new Map(
          attendanceData.map((a) => [a.studentId, a])
        );

        rows = studentsData
          .filter((s) => attMap.has(s.id)) // only show students with recorded attendance
          .sort((a, b) => a.firstName.localeCompare(b.firstName))
          .map((s) => {
            const att = attMap.get(s.id)!;
            const cls = studentClassMap.get(s.id);
            return {
              studentId: s.id,
              studentCode: s.studentCode,
              firstName: s.firstName,
              lastName: s.lastName,
              className: cls?.className ?? "Unknown",
              classTrack: cls?.classTrack ?? "unknown",
              attended: att.attended,
              remarks: att.remarks,
            };
          });
      }
    }
  }

  // ── 4. Track options ──────────────────────────────────────────────────────────
  const trackOptions = [
    { value: "all", label: "All Tracks" },
    { value: "hifz", label: "Hifz" },
    { value: "madrasa", label: "Madrasa" },
    { value: "school", label: "School" },
  ];

  // ── 5. Stats for the selected meeting (across all classes) ───────────────────
  const totalAttendance = selectedMeeting
    ? await db.query.parentMeetingAttendance.findMany({
        where: eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
      })
    : [];

  const overallAttended = totalAttendance.filter((a) => a.attended).length;
  const overallTotal = totalAttendance.length;

  return (
    <div className="print:m-0 print:p-0">
      {/* Page Header — hidden on print */}
      <div className="print:hidden">
        <PageHeader
          title="Parent Meeting Report"
          description="Detailed attendance report for any parent meeting, filterable by class and status"
          breadcrumbs={[
            { label: "Admin" },
            { label: "Reports", href: "/admin/reports" },
            { label: "Parent Meetings" },
          ]}
          action={<PrintButton />}
        />
      </div>

      {/* Print-only page title */}
      <div className="hidden print:block mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider">HQMS</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">
          Parent Meeting Report
        </h1>
      </div>

      {allMeetings.length === 0 ? (
        <div className="border border-border rounded-lg p-16 text-center text-muted-foreground">
          <CalendarDays size={36} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No meetings scheduled yet</p>
          <p className="text-xs mt-2">
            Schedule parent meetings via{" "}
            <Link
              href="/admin/settings/parent-meetings"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Settings → Parent Meetings
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
          <div className="lg:w-72 shrink-0 space-y-6 print:hidden">

            {/* Track + Class filters */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Filters
              </p>

              {/* Track */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Track
                </label>
                <div className="space-y-1">
                  {trackOptions.map((t) => (
                    <Link
                      key={t.value}
                      href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId ?? ""}&track=${t.value}&classId=all`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
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

              {/* Class — shown when a specific track is chosen */}
              {trackFilter !== "all" && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Class
                  </label>
                  <div className="space-y-1">
                    <Link
                      href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId ?? ""}&track=${trackFilter}&classId=all`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                        !selectedClassId
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      All Classes
                    </Link>
                    {filteredClassesByTrack.map((cls) => (
                      <Link
                        key={cls.id}
                        href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId ?? ""}&track=${trackFilter}&classId=${cls.id}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Select Meeting
              </p>

              <div className="space-y-2">
                {upcoming.length > 0 && (
                  <p className="text-xs text-amber-600 font-medium px-1">
                    Upcoming
                  </p>
                )}
                {upcoming.map((m) => (
                    <Link
                      key={m.id}
                      href={`/admin/reports/parent-meetings?meetingId=${m.id}&track=${trackFilter}&classId=${selectedClassId ?? "all"}`}
                      className={`block px-3 py-2.5 border rounded-sm text-sm transition-all ${
                        selectedMeetingId === m.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <p className="font-medium text-foreground truncate">
                        {m.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(m.meetingDate).split(",")[0]},{" "}
                        {new Date(m.meetingDate + "T00:00:00").toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </Link>
                  ))}


                {past.length > 0 && (
                  <p className="text-xs text-muted-foreground font-medium px-1 pt-1">
                    Past
                  </p>
                )}
                {past.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/reports/parent-meetings?meetingId=${m.id}&track=${trackFilter}&classId=${selectedClassId ?? "all"}`}
                    className={`block px-3 py-2.5 border rounded-sm text-sm transition-all ${
                      selectedMeetingId === m.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30 opacity-70"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">
                      {m.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.meetingDate + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Overall stats for selected meeting */}
            {selectedMeeting && overallTotal > 0 && (
              <div className="bg-muted/40 border border-border rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  School-Wide Summary
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recorded</span>
                    <span className="font-medium">{overallTotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Attended</span>
                    <span className="font-medium text-emerald-700">{overallAttended}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Absent</span>
                    <span className="font-medium text-red-600">{overallTotal - overallAttended}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0}% overall
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Main Content ──────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {!selectedMeeting ? (
              <div className="border border-border rounded-lg p-16 text-center text-muted-foreground text-sm">
                <CalendarDays size={28} className="mx-auto mb-3 opacity-40" />
                <p>Select a meeting to view its report</p>
              </div>
            ) : (
              <>
                {/* Meeting header */}
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-playfair text-xl font-semibold text-foreground">
                      {selectedMeeting.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatDate(selectedMeeting.meetingDate)}
                    </p>
                    {selectedMeeting.description && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {selectedMeeting.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-muted border border-border rounded-full">
                        {trackFilter === "all" ? "All Tracks" : trackFilter.charAt(0).toUpperCase() + trackFilter.slice(1)}
                      </span>
                      {selectedClassId && (
                        <span className="text-xs px-2 py-0.5 bg-muted border border-border rounded-full">
                          {allClasses.find((c) => c.id === selectedClassId)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {rows.length === 0 && overallTotal === 0 ? (
                  <div className="border border-border rounded-lg p-16 text-center text-muted-foreground">
                    <ClipboardListIcon className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No attendance recorded yet</p>
                    <p className="text-xs mt-1">
                      Attendance can be marked via{" "}
                      <Link
                        href={`/admin/parent-meetings?meetingId=${selectedMeetingId}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Parent Meetings
                      </Link>
                      .
                    </p>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                    <p className="font-medium">No attendance data for the selected filters</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">
                      Try selecting a different class or track.
                    </p>
                  </div>
                ) : (
                  <ParentMeetingReportClient
                    meeting={{
                      id: selectedMeeting.id,
                      title: selectedMeeting.title,
                      meetingDate: selectedMeeting.meetingDate,
                      description: selectedMeeting.description,
                    }}
                    rows={rows}
                    allClasses={allClasses.map((c) => ({
                      id: c.id,
                      name: c.name,
                      track: c.track,
                    }))}
                    selectedClassId={selectedClassId}
                    formattedDate={formatDate(selectedMeeting.meetingDate)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline icon to avoid lucide import issues server-side
function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}
