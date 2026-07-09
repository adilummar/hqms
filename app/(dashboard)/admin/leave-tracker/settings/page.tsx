import { requireAdmin } from "@/lib/auth/helpers";
import { getLeavePeriods, getAllLeaveActivities } from "@/lib/actions/leave-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { LeaveSettingsClient } from "@/components/leave-tracker/LeaveSettingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leave Tracker — Settings" };

export default async function LeaveSettingsPage() {
  await requireAdmin();

  const [periods, activities] = await Promise.all([
    getLeavePeriods(),
    getAllLeaveActivities(),
  ]);

  return (
    <div>
      <PageHeader title="Leave Tracker" description="Settings" />
      <LeaveSettingsClient periods={periods as any} activities={activities} />
    </div>
  );
}
