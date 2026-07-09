import { requireAdmin } from "@/lib/auth/helpers";
import { getActiveLeavePeriod, getAllLeaveResponses, getStudentsForLeaveTracker, getLeaveActivities } from "@/lib/actions/leave-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { LeaveStudentsClient } from "@/components/leave-tracker/LeaveStudentsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leave Tracker — Students" };

export default async function LeaveStudentsPage() {
  await requireAdmin();

  const [period, students, activities] = await Promise.all([
    getActiveLeavePeriod(),
    getStudentsForLeaveTracker(),
    getLeaveActivities(),
  ]);

  if (!period) {
    return (
      <div>
        <PageHeader title="Leave Tracker" description="Students" />
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">No active leave period.</p>
        </div>
      </div>
    );
  }

  const responses = await getAllLeaveResponses(period.id);

  return (
    <div>
      <PageHeader title="Leave Tracker" description="Students" />
      <LeaveStudentsClient
        period={period as any}
        students={students as any}
        activities={activities}
        responses={responses as any}
      />
    </div>
  );
}
