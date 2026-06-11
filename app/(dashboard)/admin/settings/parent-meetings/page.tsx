import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { parentMeetings, parentMeetingAttendance } from "@/lib/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { CreateMeetingForm } from "@/components/meetings/create-meeting-form";
import { DeleteMeetingButton } from "@/components/meetings/delete-meeting-button";
import { CalendarDays, Users, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parent Meetings | Settings" };

export default async function ParentMeetingsPage() {
  await requireRole(["super_admin"]);

  const meetings = await db.query.parentMeetings.findMany({
    orderBy: [desc(parentMeetings.meetingDate)],
    with: {
      attendanceRecords: { columns: { id: true, attended: true } },
      createdByUser: { columns: { username: true } },
    },
  });

  const today = new Date().toISOString().split("T")[0];

  const upcoming = meetings.filter((m) => m.meetingDate >= today);
  const past = meetings.filter((m) => m.meetingDate < today);

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function MeetingCard({ meeting }: { meeting: (typeof meetings)[number] }) {
    const total = meeting.attendanceRecords.length;
    const attended = meeting.attendanceRecords.filter((r) => r.attended).length;
    const isPast = meeting.meetingDate < today;

    return (
      <div className="bg-card border border-border rounded-lg p-4 flex items-start justify-between gap-4">
        <div className="flex gap-3 items-start flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isPast ? "bg-muted" : "bg-amber-100"}`}>
            <CalendarDays size={18} className={isPast ? "text-muted-foreground" : "text-amber-700"} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{meeting.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(meeting.meetingDate)}</p>
            {meeting.description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{meeting.description}</p>
            )}
            {total > 0 && (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {total} recorded
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={11} />
                  {attended} attended
                </span>
              </div>
            )}
            {total === 0 && isPast && (
              <p className="text-xs text-amber-600 mt-1">No attendance recorded yet</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DeleteMeetingButton meetingId={meeting.id} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Parent Meetings"
        description="Schedule whole-school parent-teacher meetings and track attendance"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Settings", href: "/admin/settings" },
          { label: "Parent Meetings" },
        ]}
      />

      {/* Create form */}
      <CreateMeetingForm />

      {/* Upcoming meetings */}
      <div className="mb-6">
        <h3 className="font-playfair text-base font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          Upcoming ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <div className="border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
            No upcoming meetings scheduled. Use the button above to schedule one.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </div>

      {/* Past meetings */}
      {past.length > 0 && (
        <div>
          <h3 className="font-playfair text-base font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />
            Past ({past.length})
          </h3>
          <div className="space-y-3">
            {past.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
