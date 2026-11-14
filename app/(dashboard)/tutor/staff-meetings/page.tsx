import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { staffMeetings } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { categoryLabel } from "@/lib/staff-meetings/participants";
import { PageHeader } from "@/components/layout/page-header";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  Gavel,
  ChevronRight,
  Briefcase,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Meetings & Resolutions | Tutor",
  description: "View staff meetings, agendas, minutes and institutional decisions",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TutorStaffMeetingsPage() {
  const session = await requireRole([
    "tutor",
    "admin",
    "super_admin",
    "school_admin",
    "madrasa_admin",
  ]);

  const allMeetings = await db.query.staffMeetings.findMany({
    orderBy: [desc(staffMeetings.meetingDate), desc(staffMeetings.createdAt)],
    with: {
      createdByUser: {
        columns: { username: true, role: true },
      },
      attendanceRecords: {
        where: (att, { eq }) => eq(att.userId, session.user.id),
        columns: { attended: true, remarks: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* ── Top Tabs (Parent Meetings vs Staff Meetings) ── */}
      <div className="flex items-center gap-2 border-b border-border pb-3 font-dm-sans">
        <Link
          href="/tutor/parent-meetings"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
        >
          <UsersRound size={15} />
          Parent Meetings
        </Link>
        <Link
          href="/tutor/staff-meetings"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-foreground text-background transition-colors flex items-center gap-2 shadow-xs"
        >
          <Briefcase size={15} />
          Staff Meetings
        </Link>
      </div>

      <PageHeader
        title="Staff Meetings & Decisions"
        description="Review scheduled institutional sessions, minutes of meeting, and finalized faculty decisions"
        breadcrumbs={[{ label: "Tutor" }, { label: "Staff Meetings" }]}
      />

      {/* ── Meeting List ── */}
      {allMeetings.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center text-muted-foreground bg-card">
          <Briefcase size={36} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No staff meetings published</p>
          <p className="text-xs mt-1 max-w-sm mx-auto font-dm-sans">
            Meetings scheduled by the administration will appear here along with agendas and official decisions taken.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allMeetings.map((meeting) => {
            const myAttendance = meeting.attendanceRecords[0];
            const hasDecisions = !!meeting.decisions?.trim();
            const hasMinutes = !!meeting.minutes?.trim();

            return (
              <div
                key={meeting.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-foreground/30 transition-all shadow-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                        href={`/tutor/staff-meetings/${meeting.id}`}
                        className="text-base font-bold font-inter text-foreground hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                      >
                        {meeting.title}
                      </Link>

                      {meeting.category && (
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground border border-border font-medium font-dm-sans">
                          {categoryLabel(meeting.category, meeting.customCategory)}
                        </span>
                      )}

                      {hasDecisions && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 font-dm-sans">
                          <Gavel size={11} /> Decisions Published
                        </span>
                      )}

                      {hasMinutes && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium dark:bg-blue-950/40 dark:text-blue-300 font-dm-sans">
                          <FileText size={11} /> MOM Logged
                        </span>
                      )}

                      {myAttendance && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            myAttendance.attended
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
                              : "bg-red-50 text-red-700 dark:bg-red-950/30"
                          }`}
                        >
                          {myAttendance.attended ? "Your status: Present" : "Your status: Absent"}
                        </span>
                      )}
                    </div>

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
                      {meeting.createdByUser && (
                        <span>
                          Convened by: <strong className="text-foreground">{meeting.createdByUser.username}</strong>
                        </span>
                      )}
                    </div>

                    {meeting.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 font-dm-sans">
                        Agenda: {meeting.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    <Link
                      href={`/tutor/staff-meetings/${meeting.id}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-all font-dm-sans shadow-xs"
                    >
                      <span>View Details & Decisions</span>
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
