import { requireTutor } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  parentMeetings,
  parentMeetingAttendance,
  enrollments,
  students,
  classes,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, gte, lte } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { ParentMeetingRoster } from "@/components/meetings/parent-meeting-roster";
import { CalendarDays, Clock } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parent Meetings | Tutor" };

interface Props {
  searchParams: Promise<{ meetingId?: string; classId?: string }>;
}

export default async function TutorParentMeetingsPage({ searchParams }: Props) {
  const session = await requireTutor();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0];

  // Get all meetings (upcoming first, then past)
  const allMeetings = await db.query.parentMeetings.findMany({
    orderBy: [desc(parentMeetings.meetingDate)],
  });

  const upcoming = allMeetings.filter((m) => m.meetingDate >= today);
  const past = allMeetings.filter((m) => m.meetingDate < today);
  const sortedMeetings = [...upcoming, ...past];

  // Selected meeting (default to first upcoming, or first past)
  const selectedMeetingId = params.meetingId ?? sortedMeetings[0]?.id;
  const selectedMeeting = sortedMeetings.find((m) => m.id === selectedMeetingId);

  // Get tutor's classes
  const tutorClasses = await db.query.classes.findMany({
    where: and(eq(classes.tutorId, session.user.id), eq(classes.isActive, true)),
  });

  const selectedClassId = params.classId ?? tutorClasses[0]?.id;
  const selectedClass = tutorClasses.find((c) => c.id === selectedClassId);

  // Fetch students and existing attendance
  let studentList: { id: string; studentCode: string; firstName: string; lastName: string | null }[] = [];
  let existingAttendance: { studentId: string; attended: boolean; remarks: string | null }[] = [];

  if (selectedMeeting && selectedClassId) {
    const classEnrollments = await db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, selectedClassId), eq(enrollments.status, "active")),
    });

    if (classEnrollments.length > 0) {
      const studentIds = classEnrollments.map((e) => e.studentId);

      const [studentsData, attendance] = await Promise.all([
        db.query.students.findMany({
          where: and(
            eq(students.status, "active"),
            inArray(students.id, studentIds)
          ),
          columns: { id: true, studentCode: true, firstName: true, lastName: true },
        }),
        db.query.parentMeetingAttendance.findMany({
          where: and(
            eq(parentMeetingAttendance.meetingId, selectedMeetingId!),
            inArray(parentMeetingAttendance.studentId, studentIds)
          ),
        }),
      ]);

      studentList = studentsData
        .sort((a, b) => a.firstName.localeCompare(b.firstName));

      existingAttendance = attendance.map((a) => ({
        studentId: a.studentId,
        attended: a.attended,
        remarks: a.remarks,
      }));
    }
  }

  const isAlreadyMarked = existingAttendance.length > 0;

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      <PageHeader
        title="Parent Meeting Attendance"
        description="Mark parent attendance for school-wide meetings"
        breadcrumbs={[{ label: "Tutor" }, { label: "Parent Meetings" }]}
      />

      {allMeetings.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <CalendarDays size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No meetings scheduled yet</p>
          <p className="text-xs mt-1">Super Admin will schedule parent meetings here.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Meeting + Class selectors */}
          <div className="lg:w-72 shrink-0 space-y-4">
            {/* Class selector */}
            {tutorClasses.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Your Class</p>
                <div className="space-y-1">
                  {tutorClasses.map((cls) => (
                    <Link
                      key={cls.id}
                      href={`/tutor/parent-meetings?meetingId=${selectedMeetingId ?? ""}&classId=${cls.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                        selectedClassId === cls.id
                          ? "bg-foreground text-background"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cls.name}
                      <span className="text-xs opacity-60 capitalize">({cls.track})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Meeting list */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Select Meeting</p>
              <div className="space-y-2">
                {upcoming.length > 0 && (
                  <p className="text-xs text-amber-600 font-medium px-1">Upcoming</p>
                )}
                {upcoming.map((m) => (
                  <Link
                    key={m.id}
                    href={`/tutor/parent-meetings?meetingId=${m.id}&classId=${selectedClassId ?? ""}`}
                    className={`block px-3 py-2.5 border rounded-sm text-sm transition-all ${
                      selectedMeetingId === m.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(m.meetingDate)}</p>
                  </Link>
                ))}

                {past.length > 0 && (
                  <p className="text-xs text-muted-foreground font-medium px-1 pt-2">Past</p>
                )}
                {past.map((m) => (
                  <Link
                    key={m.id}
                    href={`/tutor/parent-meetings?meetingId=${m.id}&classId=${selectedClassId ?? ""}`}
                    className={`block px-3 py-2.5 border rounded-sm text-sm transition-all ${
                      selectedMeetingId === m.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30 opacity-70"
                    }`}
                  >
                    <p className="font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(m.meetingDate)}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Roster */}
          <div className="flex-1 min-w-0">
            {!selectedMeeting ? (
              <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                Select a meeting to mark attendance
              </div>
            ) : tutorClasses.length === 0 ? (
              <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                You are not assigned to any class.
              </div>
            ) : studentList.length === 0 ? (
              <div className="border border-border rounded-lg p-12 text-center text-muted-foreground text-sm">
                No active students in this class.
              </div>
            ) : (
              <>
                {isAlreadyMarked && (
                  <div className="mb-4 px-4 py-3 bg-muted border border-border rounded-sm text-sm text-muted-foreground">
                    ℹ️ Attendance already marked for this meeting. Saving again will overwrite.
                  </div>
                )}
                <ParentMeetingRoster
                  meetingId={selectedMeeting.id}
                  meetingTitle={selectedMeeting.title}
                  meetingDate={selectedMeeting.meetingDate}
                  students={studentList}
                  existingAttendance={existingAttendance}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
