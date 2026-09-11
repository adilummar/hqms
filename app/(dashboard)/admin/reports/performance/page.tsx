import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { getStudentPerformance } from "@/lib/actions/reports";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ studentId?: string; period?: string; date?: string }>;
}

export default async function StudentPerformanceReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const allStudents = await db.query.students.findMany({
    where: eq(students.status, "active"),
    orderBy: [asc(students.firstName)],
  });

  const selectedStudentId = params.studentId || allStudents[0]?.id;
  const period = params.period || "monthly";
  const dateStr = params.date || new Date().toISOString().split("T")[0];

  let startDate = new Date();
  let endDate = new Date();
  const refDate = new Date(dateStr);

  if (period === "weekly") {
    // Start of week (Sunday)
    const day = refDate.getDay();
    startDate = new Date(refDate);
    startDate.setDate(refDate.getDate() - day);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (period === "monthly") {
    startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
  } else if (period === "yearly") {
    startDate = new Date(refDate.getFullYear(), 0, 1);
    endDate = new Date(refDate.getFullYear(), 11, 31);
  }

  let report = null;
  const student = allStudents.find(s => s.id === selectedStudentId);

  if (selectedStudentId) {
    report = await getStudentPerformance(selectedStudentId, startDate, endDate);
  }

  return (
    <div>
      <PageHeader 
        title="Student Performance" 
        description="Consolidated overview of a student's activity" 
        breadcrumbs={[
          { label: "Admin" }, 
          { label: "Reports", href: "/admin/reports" },
          { label: "Performance" }
        ]}
      />

      <div className="bg-card border border-border rounded-lg p-5 mb-6 flex flex-wrap gap-4 items-end">
        <form className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Student</label>
            <select name="studentId" defaultValue={selectedStudentId} className="h-9 px-3 text-sm border border-border rounded-sm bg-background">
              {allStudents.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Period</label>
            <select name="period" defaultValue={period} className="h-9 px-3 text-sm border border-border rounded-sm bg-background">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Reference Date</label>
            <input type="date" name="date" defaultValue={dateStr} className="h-9 px-3 text-sm border border-border rounded-sm bg-background" />
          </div>
          <button type="submit" className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm">
            View Report
          </button>
        </form>
      </div>

      {report && student ? (
        <div className="bg-card border border-border rounded-lg p-6 max-w-4xl space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-playfair font-semibold">Student Performance</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Student: <span className="font-medium text-foreground">{student.firstName} {student.lastName}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Period: {period.charAt(0).toUpperCase() + period.slice(1)} — {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Study</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">Juz Equivalent</p>
                <p className="text-2xl font-jetbrains mt-1">{report.study.juzEquivalent.toFixed(2)} Juz</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">Total Sabaq Pages</p>
                <p className="text-2xl font-jetbrains mt-1">{report.study.totalSabaqPages}</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">Sabaq Juz Not Given</p>
                <p className="text-2xl font-jetbrains mt-1">{report.study.sabaqNotGiven}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Attendance</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 border border-border rounded-md bg-emerald-50 border-emerald-100">
                <p className="text-xs text-emerald-600">Full Day Present</p>
                <p className="text-2xl font-jetbrains mt-1 text-emerald-700">{report.attendance.fullDaysPresent}</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-blue-50 border-blue-100">
                <p className="text-xs text-blue-600">Half Day Present</p>
                <p className="text-2xl font-jetbrains mt-1 text-blue-700">{report.attendance.halfDaysPresent}</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-red-50 border-red-100">
                <p className="text-xs text-red-600">Full Day Absent</p>
                <p className="text-2xl font-jetbrains mt-1 text-red-700">{report.attendance.fullDaysAbsent}</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground">Overall %</p>
                <p className="text-2xl font-jetbrains mt-1">{report.attendance.attendancePercentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Leave</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">School Leave Days (Sick/Casual/etc.)</p>
                <p className="text-2xl font-jetbrains mt-1">{report.leave.schoolLeaveDays}</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">Holiday Tracker Completions</p>
                <p className="text-2xl font-jetbrains mt-1">{report.leave.holidayTrackerCompleted}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stars</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-blue-200 rounded-md bg-blue-50">
                <p className="text-xs text-blue-600 font-semibold">Blue Stars</p>
                <p className="text-2xl font-jetbrains mt-1 text-blue-700">{report.stars.blue}</p>
              </div>
              <div className="p-4 border border-gray-300 rounded-md bg-gray-100">
                <p className="text-xs text-gray-700 font-semibold">Black Stars</p>
                <p className="text-2xl font-jetbrains mt-1 text-gray-800">{report.stars.black}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Parent Meeting</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 border border-emerald-200 rounded-md bg-emerald-50">
                <p className="text-[10px] uppercase text-emerald-700 font-semibold">On Time</p>
                <p className="text-xl font-jetbrains mt-1 text-emerald-800">{report.parentMeeting.onTime}</p>
              </div>
              <div className="p-3 border border-blue-200 rounded-md bg-blue-50">
                <p className="text-[10px] uppercase text-blue-700 font-semibold">Late</p>
                <p className="text-xl font-jetbrains mt-1 text-blue-800">{report.parentMeeting.late}</p>
              </div>
              <div className="p-3 border border-amber-200 rounded-md bg-amber-50">
                <p className="text-[10px] uppercase text-amber-700 font-semibold">Absent (Reason)</p>
                <p className="text-xl font-jetbrains mt-1 text-amber-800">{report.parentMeeting.absentWithReason}</p>
              </div>
              <div className="p-3 border border-red-200 rounded-md bg-red-50">
                <p className="text-[10px] uppercase text-red-700 font-semibold">Absent (No Valid)</p>
                <p className="text-xl font-jetbrains mt-1 text-red-800">{report.parentMeeting.absentWithoutReason}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-muted-foreground border border-dashed rounded-lg">
          Please select a student and period to generate the report.
        </div>
      )}
    </div>
  );
}
