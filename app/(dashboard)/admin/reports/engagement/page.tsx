import { requireAdmin } from "@/lib/auth/helpers";
import { PageHeader } from "@/components/layout/page-header";
import { getParentEngagement } from "@/lib/actions/reports";

interface Props {
  searchParams: Promise<{ period?: string; date?: string }>;
}

export default async function ParentEngagementReportPage({ searchParams }: Props) {
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

  const engagement = await getParentEngagement(startDate, endDate);

  return (
    <div>
      <PageHeader 
        title="Parent Engagement Report" 
        description="View parent activity and login metrics" 
        breadcrumbs={[
          { label: "Admin" }, 
          { label: "Reports", href: "/admin/reports" },
          { label: "Parent Engagement" }
        ]}
      />

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-6 text-sm">
        <p className="font-semibold mb-1">Data Source Limitation Notice</p>
        <p>Currently, the parent engagement report is based solely on <code>lastLoginAt</code>. Reliable daily activity events are not being logged for read-only parent actions by the authentication system, meaning Active Days counts are limited. This report displays the most recent successful login time for each parent.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 mb-6 flex flex-wrap gap-4 items-end">
        <form className="flex gap-4 items-end">
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
            Refresh
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Username (Phone/Admn No)</th>
              <th className="px-4 py-3 font-medium">Linked Student</th>
              <th className="px-4 py-3 font-medium">Student Code</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {engagement.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No parents found</td>
              </tr>
            ) : (
              engagement.map(e => (
                <tr key={e.userId} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{e.username}</td>
                  <td className="px-4 py-3">{e.linkedStudentName}</td>
                  <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">{e.linkedStudentCode}</td>
                  <td className="px-4 py-3">
                    {e.lastLoginAt ? new Date(e.lastLoginAt).toLocaleString("en-IN") : <span className="text-muted-foreground italic">Never logged in</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
