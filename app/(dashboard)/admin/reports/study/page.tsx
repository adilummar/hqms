import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { getStudyProgress } from "@/lib/actions/reports";

interface Props {
  searchParams: Promise<{ studentId?: string; period?: string; date?: string }>;
}

export default async function StudyProgressReportPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const allStudents = await db.query.students.findMany({
    where: eq(students.status, "active"),
    orderBy: [asc(students.firstName)],
  });

  const selectedStudentId = params.studentId || allStudents[0]?.id;
  const period = params.period || "weekly";
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
  const student = allStudents.find(s => s.id === selectedStudentId);

  if (selectedStudentId) {
    report = await getStudyProgress(selectedStudentId, startDate, endDate);
  }

  return (
    <div>
      <PageHeader 
        title="Study Progress Report" 
        description="Detailed breakdown of Juz and Page progress" 
        breadcrumbs={[
          { label: "Admin" }, 
          { label: "Reports", href: "/admin/reports" },
          { label: "Study Progress" }
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
            <h2 className="text-xl font-playfair font-semibold">Study Progress — {period.charAt(0).toUpperCase() + period.slice(1)}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Student: <span className="font-medium text-foreground">{student.firstName} {student.lastName}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-border rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Total Juz Equivalent</p>
              <p className="text-2xl font-jetbrains mt-1">{report.totalJuzEquivalent.toFixed(2)} Juz</p>
            </div>
            <div className="p-4 border border-border rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Total Pages</p>
              <p className="text-2xl font-jetbrains mt-1">{report.totalPages} pages</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Daily Breakdown</h3>
            {report.dailyProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground">No study records for this period.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Juz #</th>
                      <th className="px-4 py-3 font-medium text-right">Pages</th>
                      <th className="px-4 py-3 font-medium text-right">Juz Equivalent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.dailyProgress.map((day, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">{new Date(day.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-jetbrains">{day.juzNumber ?? "—"}</td>
                        <td className="px-4 py-3 font-jetbrains text-right">{day.pages}</td>
                        <td className="px-4 py-3 font-jetbrains text-right font-medium">{day.juzFormatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
