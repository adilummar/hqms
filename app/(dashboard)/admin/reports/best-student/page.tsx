import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { getAllStudentsRawMetrics } from "@/lib/actions/reports-best";

interface Props {
  searchParams: Promise<{ classId?: string; period?: string; date?: string }>;
}

export default async function BestStudentReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const allClasses = await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [asc(classes.displayOrder)],
  });

  const classId = params.classId ?? null;
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

  const rows = await getAllStudentsRawMetrics(classId, startDate, endDate);

  return (
    <div>
      <PageHeader
        title="Best Student — Raw Metrics"
        description="Underlying data for future ranking formula"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Reports", href: "/admin/reports" },
          { label: "Best Student" },
        ]}
      />

      {/* Pending Formula Banner */}
      <div className="border border-amber-300 bg-amber-50 text-amber-800 rounded-lg px-5 py-4 mb-6 text-sm">
        <p className="font-semibold">⚠ Automatic ranking formula pending business decision</p>
        <p className="mt-1 text-amber-700">
          Best Student is based on: <strong>Leave</strong>, <strong>Stars</strong>, and <strong>Study</strong>.
          The exact mathematical weighting has not yet been finalized. The raw metrics below are displayed
          as-is. No score or rank is calculated until the formula is explicitly approved.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <form className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Class (optional)</label>
            <select name="classId" defaultValue={classId ?? ""} className="h-9 px-3 text-sm border border-border rounded-sm bg-background">
              <option value="">All Classes</option>
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

      {/* Raw Metrics Table */}
      {rows.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border border-dashed rounded-lg">
          No active students found for the selected filters.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium text-right">Study (Juz)</th>
                  <th className="px-4 py-3 font-medium text-right">Att. %</th>
                  <th className="px-4 py-3 font-medium text-right">School Leaves</th>
                  <th className="px-4 py-3 font-medium text-right">Holiday Leaves</th>
                  <th className="px-4 py-3 font-medium text-center text-blue-600">Blue ★</th>
                  <th className="px-4 py-3 font-medium text-center text-gray-600">Black ★</th>
                  <th className="px-4 py-3 font-medium text-center text-muted-foreground">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, idx) => (
                  <tr key={row.studentId} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground font-jetbrains text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.firstName} {row.lastName ?? ""}</p>
                      <p className="text-xs text-muted-foreground font-jetbrains">{row.studentCode}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.className}</td>
                    <td className="px-4 py-3 text-right font-jetbrains">{row.study.juzEquivalent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-jetbrains">{row.attendance.attendancePercentage.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right font-jetbrains">{row.leave.schoolLeaveDays}</td>
                    <td className="px-4 py-3 text-right font-jetbrains">{row.leave.holidayTrackerCompleted}</td>
                    <td className="px-4 py-3 text-center font-jetbrains text-blue-700 font-semibold">{row.stars.blue}</td>
                    <td className="px-4 py-3 text-center font-jetbrains text-gray-700 font-semibold">{row.stars.black}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted-foreground italic">Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Blue ★ and Black ★ are strictly independent — no net score is calculated.
            Attendance % = Present Sessions ÷ (Present + Absent Sessions) × 100. Unmarked sessions are excluded.
          </div>
        </div>
      )}
    </div>
  );
}
