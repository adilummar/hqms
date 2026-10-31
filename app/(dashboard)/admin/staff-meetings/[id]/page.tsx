import { requireAdmin } from "@/lib/auth/helpers";
import { getStaffMeetingDetails } from "@/lib/actions/staff-meetings";
import { PageHeader } from "@/components/layout/page-header";
import { StaffMeetingMinutesEditor } from "@/components/staff-meetings/staff-meeting-minutes-editor";
import { StaffMeetingAttendanceSheet } from "@/components/staff-meetings/staff-meeting-attendance-sheet";
import { StaffMeetingPrintView } from "@/components/staff-meetings/staff-meeting-print-view";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Users, Printer, ArrowLeft, Gavel } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Meeting Details & Minutes | Admin",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminStaffMeetingDetailPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { tab = "minutes" } = await searchParams;

  const meeting = await getStaffMeetingDetails(id);
  if (!meeting) {
    notFound();
  }

  const activeTab = ["minutes", "attendance", "print"].includes(tab) ? tab : "minutes";

  return (
    <div className="space-y-6">
      {/* ── Back button & Top bar ── */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/staff-meetings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors font-dm-sans"
        >
          <ArrowLeft size={14} />
          Back to Staff Meetings
        </Link>
      </div>

      <PageHeader
        title={meeting.title}
        description={`Scheduled on ${new Date(meeting.meetingDate + "T00:00:00").toLocaleDateString(
          "en-IN",
          { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        )}${meeting.meetingTime ? ` at ${meeting.meetingTime}` : ""}`}
        breadcrumbs={[
          { label: "Admin" },
          { label: "Staff Meetings", href: "/admin/staff-meetings" },
          { label: meeting.title },
        ]}
      />

      {/* ── Section Navigation Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border font-dm-sans">
        <Link
          href={`/admin/staff-meetings/${id}?tab=minutes`}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "minutes"
              ? "border-teal-600 text-teal-700 dark:text-teal-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Gavel size={14} />
          <span>Minutes & Decisions</span>
        </Link>

        <Link
          href={`/admin/staff-meetings/${id}?tab=attendance`}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "attendance"
              ? "border-teal-600 text-teal-700 dark:text-teal-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users size={14} />
          <span>Staff Attendance ({meeting.roster.length})</span>
        </Link>

        <Link
          href={`/admin/staff-meetings/${id}?tab=print`}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "print"
              ? "border-teal-600 text-teal-700 dark:text-teal-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Printer size={14} />
          <span>Official Print Document</span>
        </Link>
      </div>

      {/* ── Tab Views ── */}
      {activeTab === "minutes" && (
        <StaffMeetingMinutesEditor meeting={meeting} isAdmin={true} />
      )}

      {activeTab === "attendance" && (
        <StaffMeetingAttendanceSheet
          meetingId={meeting.id}
          initialAttendees={meeting.roster}
          isAdmin={true}
        />
      )}

      {activeTab === "print" && (
        <StaffMeetingPrintView meeting={meeting} attendees={meeting.roster} />
      )}
    </div>
  );
}
