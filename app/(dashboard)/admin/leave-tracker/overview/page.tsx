import { requireAdmin } from "@/lib/auth/helpers";
import { getActiveLeavePeriod, getAllLeaveResponses, getStudentsForLeaveTracker, getLeaveActivities } from "@/lib/actions/leave-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { LeaveOverviewClient } from "@/components/leave-tracker/LeaveOverviewClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leave Tracker — Overview" };

export default async function LeaveOverviewPage() {
  await requireAdmin();

  const [period, students, activities] = await Promise.all([
    getActiveLeavePeriod(),
    getStudentsForLeaveTracker(),
    getLeaveActivities(),
  ]);

  if (!period) {
    return (
      <div>
        <PageHeader title="Leave Tracker" description="Overview" />
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">No active leave period. Go to Settings to create and activate one.</p>
        </div>
      </div>
    );
  }

  const responses = await getAllLeaveResponses(period.id);

  return (
    <div>
      <PageHeader title="Leave Tracker" description={period.name} />
      <LeaveOverviewClient
        period={period as any}
        students={students as any}
        activities={activities}
        responses={responses as any}
      />
    </div>
  );
}
