import { requireAdmin } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getAllParentsRawMetrics } from "@/lib/actions/reports-best";

interface Props {
  searchParams: Promise<{ period?: string; date?: string }>;
}

export default async function BestParentReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

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

  const rows = await getAllParentsRawMetrics(startDate, endDate);

  // Sort by On Time (desc) as a basic display aid — NOT a ranking formula
  const sorted = [...rows].sort((a, b) => b.parentMeeting.onTime - a.parentMeeting.onTime);

  return (
    <div>
      <PageHeader
        title="Best Parent — Raw Metrics"
        description="Parent meeting engagement data for future ranking"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Reports", href: "/admin/reports" },
          { label: "Best Parent" },
        ]}
      />

      {/* Pending Formula Banner */}
      <div className="border border-amber-300 bg-amber-50 text-amber-800 rounded-lg px-5 py-4 mb-6 text-sm">
        <p className="font-semibold">⚠ Automatic ranking formula pending business decision</p>
        <p className="mt-1 text-amber-700">
          Best Parent ranking has not been finalized. The raw Parent Meeting engagement metrics are displayed
          as-is. No score or rank is calculated until the formula is explicitly approved.
          The table is currently sorted by On Time count for display convenience only.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <form className="flex flex-wrap gap-4 items-end">
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

      {sorted.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border border-dashed rounded-lg">
          No parent records found.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Linked Student</th>
                  <th className="px-4 py-3 font-medium">Parent Username</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium text-center text-emerald-600">On Time</th>
                  <th className="px-4 py-3 font-medium text-center text-blue-600">Late</th>
                  <th className="px-4 py-3 font-medium text-center text-amber-600">Absent (Reason)</th>
                  <th className="px-4 py-3 font-medium text-center text-red-600">Absent (No Valid)</th>
                  <th className="px-4 py-3 font-medium text-center text-muted-foreground">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((row, idx) => (
                  <tr key={row.parentId} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground font-jetbrains text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.linkedStudentName}</p>
                      <p className="text-xs text-muted-foreground font-jetbrains">{row.linkedStudentCode}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.username}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString("en-IN") : <span className="text-muted-foreground italic">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-jetbrains text-emerald-700 font-semibold">{row.parentMeeting.onTime}</td>
                    <td className="px-4 py-3 text-center font-jetbrains text-blue-700">{row.parentMeeting.late}</td>
                    <td className="px-4 py-3 text-center font-jetbrains text-amber-700">{row.parentMeeting.absentWithReason}</td>
                    <td className="px-4 py-3 text-center font-jetbrains text-red-700">{row.parentMeeting.absentWithoutReason}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted-foreground italic">Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Sorted by On Time count for display only. No automatic ranking formula is applied.
          </div>
        </div>
      )}
    </div>
  );
}
