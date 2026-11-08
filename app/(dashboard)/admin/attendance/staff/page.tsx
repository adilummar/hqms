import { requireAdmin } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import { AdminStaffAttendanceView } from "@/components/staff-attendance/admin-staff-attendance-view";
import {
  getStaffDailyAttendanceData,
  getStaffMonthlyAttendanceData,
} from "@/lib/actions/staff-attendance";
import { getStaffOffDaySettings } from "@/lib/actions/staff-off-days";
import { toIstDate } from "@/lib/services/staff-sessions";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Staff Attendance | Admin" };

interface Props {
  searchParams: Promise<{
    view?: string;
    date?: string;
    month?: string;
    year?: string;
  }>;
}

export default async function StaffAttendancePage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const viewMode = params.view === "monthly" ? "monthly" : "daily";

  // Institution time (IST), never the server's UTC date.
  const todayIst = toIstDate(new Date());
  const [todayYear, todayMonth] = todayIst.split("-").map(Number);
  const year = params.year ? parseInt(params.year, 10) : todayYear;
  const month = params.month ? parseInt(params.month, 10) : todayMonth;
  const dateStr = params.date || todayIst;

  const [dailyData, monthlyData, offSettings] = await Promise.all([
    viewMode === "daily" ? getStaffDailyAttendanceData(dateStr) : Promise.resolve(undefined),
    viewMode === "monthly" ? getStaffMonthlyAttendanceData(year, month) : Promise.resolve(undefined),
    getStaffOffDaySettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Attendance"
        description="Forenoon (FN) and Afternoon (AN) attendance of Hifz tutors: daily log and monthly matrix."
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
        offSettings={offSettings}
      />
    </div>
  );
}
