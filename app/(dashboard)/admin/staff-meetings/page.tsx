import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { staffMeetings, staffMeetingAttendance } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getHifzTutors } from "@/lib/services/hifz-tutors";
import { PageHeader } from "@/components/layout/page-header";
import { CreateStaffMeetingDialog } from "@/components/staff-meetings/create-staff-meeting-dialog";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  UsersRound,
  FileText,
  Gavel,
  ChevronRight,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Meetings & Minutes | Admin",
  description: "Schedule staff meetings, record minutes of meeting and key decisions",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminStaffMeetingsPage() {
  await requireAdmin();

  const today = new Date().toISOString().split("T")[0];

  // Only Hifz tutors count towards staff meeting attendance
  const hifzTutorIds = new Set((await getHifzTutors()).map((t) => t.id));

  const allMeetingsRaw = await db.query.staffMeetings.findMany({
    orderBy: [desc(staffMeetings.meetingDate), desc(staffMeetings.createdAt)],
    with: {
      createdByUser: {
        columns: { username: true, role: true },
      },
      attendanceRecords: {
        columns: { attended: true, userId: true },
      },
    },
  });

  const allMeetings = allMeetingsRaw.map((m) => ({
    ...m,
    attendanceRecords: m.attendanceRecords.filter((a) => hifzTutorIds.has(a.userId)),
  }));

  const totalMeetings = allMeetings.length;
  const completedMeetings = allMeetings.filter((m) => m.status === "completed").length;
  const upcomingMeetings = allMeetings.filter(
    (m) => m.status === "scheduled" && m.meetingDate >= today
  ).length;
  const meetingsWithDecisions = allMeetings.filter((m) => !!m.decisions?.trim()).length;

  return (
    <div className="space-y-6">
      {/* ── Top Tabs (Parent Meetings vs Staff Meetings) ── */}
      <div className="flex items-center gap-2 border-b border-border pb-3 font-dm-sans">
        <Link
          href="/admin/parent-meetings"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
        >
          <UsersRound size={15} />
          Parent Meetings
        </Link>
        <Link
          href="/admin/staff-meetings"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-foreground text-background transition-colors flex items-center gap-2 shadow-xs"
        >
          <Briefcase size={15} />
          Staff Meetings
        </Link>
      </div>

      <PageHeader
        title="Staff Meetings & Decisions"
        description="Schedule institutional staff meetings, document proceedings, and record formal decisions"
        breadcrumbs={[{ label: "Admin" }, { label: "Staff Meetings" }]}
        action={<CreateStaffMeetingDialog />}
      />

      {/* ── Overview Statistics Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-xs text-muted-foreground font-dm-sans font-medium uppercase">
            Total Meetings
          </p>
          <p className="text-2xl font-bold font-inter text-foreground mt-1">
            {totalMeetings}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-dm-sans">
            Institutional sessions
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-xs text-amber-600 font-dm-sans font-medium uppercase flex items-center gap-1">
            <Clock size={12} /> Upcoming
          </p>
          <p className="text-2xl font-bold font-inter text-amber-600 mt-1">
            {upcomingMeetings}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-dm-sans">
            Scheduled sessions
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-xs text-emerald-600 font-dm-sans font-medium uppercase flex items-center gap-1">
            <CheckCircle2 size={12} /> Completed
          </p>
          <p className="text-2xl font-bold font-inter text-emerald-600 mt-1">
            {completedMeetings}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-dm-sans">
            Minutes logged
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-xs text-teal-600 font-dm-sans font-medium uppercase flex items-center gap-1">
            <Gavel size={12} /> Decisions Logged
          </p>
          <p className="text-2xl font-bold font-inter text-teal-600 mt-1">
            {meetingsWithDecisions}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-dm-sans">
            With formal resolutions
          </p>
        </div>
      </div>

      {/* ── Meetings List ── */}
      {allMeetings.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center text-muted-foreground bg-card">
          <Briefcase size={36} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No staff meetings recorded</p>
          <p className="text-xs mt-1 max-w-sm mx-auto font-dm-sans">
            Click &quot;Schedule Staff Meeting&quot; above to organize your first faculty & staff session, record minutes, and track decisions.
          </p>
          <div className="mt-4 flex justify-center">
            <CreateStaffMeetingDialog />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {allMeetings.map((meeting) => {
            const attendeesCount = meeting.attendanceRecords.length;
            const presentCount = meeting.attendanceRecords.filter((a) => a.attended).length;
            const hasDecisions = !!meeting.decisions?.trim();
            const hasMinutes = !!meeting.minutes?.trim();

            return (
              <div
                key={meeting.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-foreground/30 transition-all shadow-xs group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Meeting title, date, badges */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          meeting.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : meeting.status === "cancelled"
                            ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {meeting.status}
                      </span>

                      <Link
                        href={`/admin/staff-meetings/${meeting.id}`}
                        className="text-base font-bold font-inter text-foreground hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                      >
                        {meeting.title}
                      </Link>

                      {hasDecisions ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 font-dm-sans">
                          <Gavel size={11} /> Decisions Taken
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-dm-sans">
                          Pending Decisions
                        </span>
                      )}

                      {hasMinutes && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium dark:bg-blue-950/40 dark:text-blue-300 font-dm-sans">
                          <FileText size={11} /> MOM Logged
                        </span>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap font-dm-sans">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <CalendarDays size={13} className="text-teal-600" />
                        {formatDate(meeting.meetingDate)}
                      </span>
                      {meeting.meetingTime && (
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-teal-600" />
                          {meeting.meetingTime}
                        </span>
                      )}
                      {meeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-teal-600" />
                          {meeting.location}
                        </span>
                      )}
                      {attendeesCount > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          {presentCount}/{attendeesCount} Staff Attended
                        </span>
                      )}
                      {meeting.createdByUser && (
                        <span>
                          By: <strong className="text-foreground">{meeting.createdByUser.username}</strong>
                        </span>
                      )}
                    </div>

                    {meeting.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 font-dm-sans">
                        Agenda: {meeting.description}
                      </p>
                    )}
                  </div>

                  {/* Right: Action button */}
                  <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    <Link
                      href={`/admin/staff-meetings/${meeting.id}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-all font-dm-sans shadow-xs"
                    >
                      <span>Manage Minutes & Decisions</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
