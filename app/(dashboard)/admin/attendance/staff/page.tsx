import { requireAdmin } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import { AdminStaffAttendanceView } from "@/components/staff-attendance/admin-staff-attendance-view";
import {
  getStaffDailyAttendanceData,
  getStaffMonthlyAttendanceData,
} from "@/lib/actions/staff-attendance";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Staff Attendance | Admin" };

interface Props {
  searchParams: Promise<{
    view?: string;
    date?: string;
    month?: string;
    year?: string;
    role?: string;
  }>;
}

export default async function StaffAttendancePage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const viewMode = params.view === "monthly" ? "monthly" : "daily";
  const roleFilter = params.role || "all";

  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  const dateStr = params.date || now.toISOString().split("T")[0];

  const [dailyData, monthlyData] = await Promise.all([
    viewMode === "daily"
      ? getStaffDailyAttendanceData(dateStr, roleFilter)
      : Promise.resolve(undefined),
    viewMode === "monthly"
      ? getStaffMonthlyAttendanceData(year, month, roleFilter)
      : Promise.resolve(undefined),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Attendance"
        description="Daily check-in logs, real-time presence, and monthly attendance matrix across all faculty and staff."
        breadcrumbs={[
          { label: "Admin" },
          { label: "Attendance", href: "/admin/attendance" },
          { label: "Staff Attendance" },
        ]}
      />

      {/* ── Main Attendance Navigation Tabs ─────────────────────────── */}
      <div className="flex gap-2 border-b border-border -mt-2 mb-6 print:hidden">
        <Link
          href="/admin/attendance"
          className="border-b-2 border-transparent pb-3 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors font-dm-sans"
        >
          Students Attendance
        </Link>
        <Link
          href="/admin/attendance/staff"
          className="border-b-2 border-teal pb-3 px-4 text-sm font-semibold text-foreground transition-colors font-dm-sans"
        >
          Staff Attendance
        </Link>
      </div>

      <AdminStaffAttendanceView
        viewMode={viewMode}
        dailyData={dailyData}
        monthlyData={monthlyData}
        roleFilter={roleFilter}
      />
    </div>
  );
}
