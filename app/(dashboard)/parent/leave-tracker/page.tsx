import { requireParent } from "@/lib/auth/helpers";
import { getActiveLeavePeriod, getParentStudentForLeaveTracker, getStudentLeaveResponses, getLeaveActivities } from "@/lib/actions/leave-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { ParentTrackerClient } from "@/components/leave-tracker/ParentTrackerClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leave Tracker" };

export default async function ParentLeaveTrackerPage() {
  await requireParent();

  const [activePeriod, student, activities] = await Promise.all([
    getActiveLeavePeriod(),
    getParentStudentForLeaveTracker(),
    getLeaveActivities(),
  ]);

  if (!activePeriod) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leave Tracker" />
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground font-dm-sans">
            No active leave period at the moment. Check back when the next leave period begins.
          </p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leave Tracker" />
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground font-dm-sans">Student profile not found.</p>
        </div>
      </div>
    );
  }

  const responses = await getStudentLeaveResponses(activePeriod.id, student.id);

  const hifzEnrollment = student.enrollments?.find(
    (e: { class?: { track?: string } }) => e.class?.track === "hifz"
  );
  const className = hifzEnrollment?.class?.name ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Tracker" />
      <ParentTrackerClient
        period={activePeriod}
        student={{
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName ?? "",
          studentCode: student.studentCode,
          className,
        }}
        activities={activities}
        initialResponses={responses}
      />
    </div>
  );
}
