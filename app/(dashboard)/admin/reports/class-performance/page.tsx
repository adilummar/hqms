import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { getClassPerformance } from "@/lib/actions/reports";

interface Props {
  searchParams: Promise<{ classId?: string; period?: string; date?: string }>;
}

export default async function ClassPerformanceReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [asc(classes.displayOrder)],
  });

  const selectedClassId = params.classId || allClasses[0]?.id;
  const period = params.period || "monthly";
  const dateStr = params.date || new Date().toISOString().split("T")[0];

  let startDate = new Date();
  let endDate = new Date();
  const refDate = new Date(dateStr);

  if (period === "weekly") {
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
  const targetClass = allClasses.find(c => c.id === selectedClassId);

  if (selectedClassId) {
    report = await getClassPerformance(selectedClassId, startDate, endDate);
  }

  return (
    <div>
      <PageHeader 
        title="Class Performance Overview" 
        description="Aggregate performance metrics for a class" 
        breadcrumbs={[
          { label: "Admin" }, 
          { label: "Reports", href: "/admin/reports" },
          { label: "Class Performance" }
        ]}
      />

      <div className="bg-card border border-border rounded-lg p-5 mb-6 flex flex-wrap gap-4 items-end">
        <form className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Class</label>
            <select name="classId" defaultValue={selectedClassId} className="h-9 px-3 text-sm border border-border rounded-sm bg-background">
              {allClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
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

      {report && targetClass ? (
        <div className="bg-card border border-border rounded-lg p-6 max-w-4xl space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-playfair font-semibold">Class Performance — {period.charAt(0).toUpperCase() + period.slice(1)}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Class: <span className="font-medium text-foreground">{targetClass.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Students: {report.studentCount}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Study</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">Total Juz Equivalent</p>
                <p className="text-2xl font-jetbrains mt-1">{report.study.totalJuzEquivalent.toFixed(2)} Juz</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-xs text-muted-foreground">Average / Student</p>
                <p className="text-2xl font-jetbrains mt-1">{report.study.avgJuzPerStudent.toFixed(2)} Juz</p>
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Leave & Stars</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">School Leaves</p>
                <p className="text-xl font-jetbrains mt-1 text-foreground">{report.leave.schoolLeaveDays}</p>
              </div>
              <div className="p-4 border border-border rounded-md bg-muted/20">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Holiday Leaves</p>
                <p className="text-xl font-jetbrains mt-1 text-foreground">{report.leave.holidayTrackerCompleted}</p>
              </div>
              <div className="p-4 border border-blue-200 rounded-md bg-blue-50">
                <p className="text-[10px] uppercase text-blue-600 font-semibold">Blue Stars</p>
                <p className="text-xl font-jetbrains mt-1 text-blue-700">{report.stars.blue}</p>
              </div>
              <div className="p-4 border border-gray-300 rounded-md bg-gray-100">
                <p className="text-[10px] uppercase text-gray-700 font-semibold">Black Stars</p>
                <p className="text-xl font-jetbrains mt-1 text-gray-800">{report.stars.black}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-muted-foreground border border-dashed rounded-lg">
          Please select a class and period to generate the report.
        </div>
      )}
    </div>
  );
}
