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
import { ParentMeetingRoster } from "@/components/meetings/parent-meeting-roster";
import { CalendarDays, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parent Meeting Attendance | Admin" };

interface Props {
  searchParams: Promise<{ meetingId?: string; classId?: string }>;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminParentMeetingsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];

  // All meetings (newest first)
  const allMeetings = await db.query.parentMeetings.findMany({
    orderBy: [desc(parentMeetings.meetingDate)],
  });

  const upcoming = allMeetings.filter((m) => m.meetingDate >= today);
  const past = allMeetings.filter((m) => m.meetingDate < today);
  const sortedMeetings = [...upcoming, ...past];

  const selectedMeetingId = params.meetingId ?? sortedMeetings[0]?.id;
  const selectedMeeting = sortedMeetings.find((m) => m.id === selectedMeetingId);

  // All active classes (admin can see every class)
  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [asc(classes.displayOrder), asc(classes.name)],
  });

  const selectedClassId = params.classId ?? allClasses[0]?.id;

  // Group classes by track
  const classByTrack = allClasses.reduce<Record<string, typeof allClasses>>((acc, cls) => {
    if (!acc[cls.track]) acc[cls.track] = [];
    acc[cls.track].push(cls);
    return acc;
  }, {});

  // Fetch students + existing attendance for selected meeting + class
  let studentList: { id: string; studentCode: string; firstName: string; lastName: string | null }[] = [];
  let existingAttendance: { studentId: string; attended: boolean; remarks: string | null }[] = [];

  if (selectedMeeting && selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, selectedClassId),
        eq(enrollments.status, "active")
      ),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      // Run sequentially to avoid ECONNRESET from connection pool exhaustion
      const studentsData = await db.query.students.findMany({
        where: and(eq(students.status, "active"), inArray(students.id, studentIds)),
        columns: { id: true, studentCode: true, firstName: true, lastName: true },
      });

      const attendance = await db.query.parentMeetingAttendance.findMany({
        where: and(
          eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
          inArray(parentMeetingAttendance.studentId, studentIds)
        ),
      });

      studentList = studentsData.sort((a, b) => a.firstName.localeCompare(b.firstName));
      existingAttendance = attendance.map((a) => ({
        studentId: a.studentId,
        attended: a.attended,
        remarks: a.remarks,
      }));
    }
  }


  // Per-class summary stats for the selected meeting
  const meetingStats = selectedMeeting
    ? await (async () => {
        const allAtt = await db.query.parentMeetingAttendance.findMany({
          where: eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
        });
        const attended = allAtt.filter((a) => a.attended).length;
        return { total: allAtt.length, attended, absent: allAtt.length - attended };
      })()
    : null;

  const isAlreadyMarked = existingAttendance.length > 0;
  const attendedInClass = existingAttendance.filter((a) => a.attended).length;
  const absentInClass = existingAttendance.filter((a) => !a.attended).length;
  const unmarkedInClass = studentList.length - existingAttendance.length;

  return (
    <div>
      <PageHeader
        title="Parent Meeting Attendance"
        description="Mark and manage parent attendance across all classes"
        breadcrumbs={[{ label: "Admin" }, { label: "Parent Meetings" }]}
        action={
          selectedMeeting && (
            <Link
              href={`/admin/reports/parent-meetings?meetingId=${selectedMeetingId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded hover:bg-muted transition-colors"
            >
              📊 View Full Report
            </Link>
          )
        }
      />

      {allMeetings.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <CalendarDays size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No meetings scheduled yet</p>
          <p className="text-xs mt-1">
            Super Admin can schedule parent meetings via{" "}
            <Link href="/admin/settings/parent-meetings" className="underline underline-offset-2">
              Settings → Parent Meetings
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: Meeting + Class selectors ── */}
          <div className="lg:w-68 shrink-0 space-y-4">

            {/* Meeting selector */}
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Select Meeting
              </p>
              <div className="space-y-1.5">
                {upcoming.length > 0 && (
                  <p className="text-xs text-amber-600 font-semibold px-1 flex items-center gap-1">
                    <Clock size={10} /> Upcoming
                  </p>
                )}
                {upcoming.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/parent-meetings?meetingId=${m.id}&classId=${selectedClassId ?? ""}`}
                    className={`block px-3 py-2.5 border rounded-md text-sm transition-all ${
                      selectedMeetingId === m.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(m.meetingDate)}</p>
                  </Link>
                ))}
                {past.length > 0 && (
                  <p className="text-xs text-muted-foreground font-semibold px-1 pt-1">Past</p>
                )}
                {past.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/parent-meetings?meetingId=${m.id}&classId=${selectedClassId ?? ""}`}
                    className={`block px-3 py-2.5 border rounded-md text-sm transition-all ${
                      selectedMeetingId === m.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/40 opacity-70"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(m.meetingDate)}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Overall stats for selected meeting */}
            {meetingStats && meetingStats.total > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Overall (All Classes)
                </p>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recorded</span>
                    <span className="font-semibold">{meetingStats.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} />Attended</span>
                    <span className="font-semibold text-emerald-700">{meetingStats.attended}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1 text-red-600"><XCircle size={12} />Absent</span>
                    <span className="font-semibold text-red-600">{meetingStats.absent}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${meetingStats.total > 0 ? Math.round((meetingStats.attended / meetingStats.total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-right text-muted-foreground">
                    {meetingStats.total > 0 ? Math.round((meetingStats.attended / meetingStats.total) * 100) : 0}% attendance
                  </p>
                </div>
              </div>
            )}

            {/* Class selector — grouped by track */}
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Select Class
              </p>
              <div className="space-y-3">
                {Object.entries(classByTrack).map(([track, clsList]) => (
                  <div key={track}>
                    <p className="text-xs text-muted-foreground/60 font-semibold px-1 mb-1 capitalize tracking-wide">
                      {track}
                    </p>
                    <div className="space-y-0.5">
                      {clsList.map((cls) => (
                        <Link
                          key={cls.id}
                          href={`/admin/parent-meetings?meetingId=${selectedMeetingId ?? ""}&classId=${cls.id}`}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedClassId === cls.id
                              ? "bg-foreground text-background"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>{cls.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Roster ── */}
          <div className="flex-1 min-w-0">
            {!selectedMeeting ? (
              <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                <CalendarDays size={28} className="mx-auto mb-3 opacity-40" />
                Select a meeting to mark attendance
              </div>
            ) : allClasses.length === 0 ? (
              <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                No active classes found.
              </div>
            ) : studentList.length === 0 ? (
              <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                No active students in this class.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Class attendance summary bar */}
                {existingAttendance.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{attendedInClass}</p>
                      <p className="text-xs text-emerald-600 mt-0.5 font-medium">Attended</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{absentInClass}</p>
                      <p className="text-xs text-red-500 mt-0.5 font-medium">Absent</p>
                    </div>
                    <div className={`rounded-lg px-4 py-3 text-center border ${unmarkedInClass > 0 ? "bg-amber-50 border-amber-200" : "bg-muted border-border"}`}>
                      <p className={`text-2xl font-bold ${unmarkedInClass > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{unmarkedInClass}</p>
                      <p className={`text-xs mt-0.5 font-medium ${unmarkedInClass > 0 ? "text-amber-500" : "text-muted-foreground"}`}>Unmarked</p>
                    </div>
                  </div>
                )}

                {isAlreadyMarked && (
                  <div className="px-4 py-3 bg-muted border border-border rounded-md text-sm text-muted-foreground">
                    ℹ️ Attendance already marked for this class. Saving again will overwrite.
                  </div>
                )}

                <ParentMeetingRoster
                  meetingId={selectedMeeting.id}
                  meetingTitle={selectedMeeting.title}
                  meetingDate={selectedMeeting.meetingDate}
                  students={studentList}
                  existingAttendance={existingAttendance}
                  revalidatePaths={["/admin/parent-meetings", "/admin/settings/parent-meetings", "/tutor/parent-meetings"]}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
