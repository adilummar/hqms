import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, juzTracker, admissionApplications, classes, enrollments, monthlyTargets } from "@/lib/db/schema";
import { eq, count, and, between, asc, sql } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { ToppersList } from "@/components/hifz/toppers-list";
import { PrintableSortableReport, ReportRow } from "@/components/reports/printable-sortable-report";
import Link from "next/link";
import type { Metadata } from "next";
import { getDefaultMonthlyTarget } from "@/lib/hifz-targets";

export const metadata: Metadata = { title: "Reports" };

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const monthName = new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Fetch summary stats
  const [activeStudents, juzThisMonth, pendingApps, juzByClass] = await Promise.all([
    db.select({ count: count() }).from(students).where(eq(sql`${students.status}::text`, "active")),
    db.select({ count: count() }).from(juzTracker).where(
      between(juzTracker.completionDate!, monthStart, monthEnd)
    ),
    db.select({ count: count() }).from(admissionApplications).where(eq(sql`${admissionApplications.status}::text`, "pending")),
    // Juz completions per Hifz class this month
    db.query.classes.findMany({
      where: and(eq(classes.track, "hifz"), eq(classes.isActive, true)),
      orderBy: [asc(classes.displayOrder)],
    }),
  ]);

  // Data for table and toppers
  const hifzClassIds = juzByClass.map(c => c.id);
  const classMap = new Map(juzByClass.map(c => [c.id, c.name]));

  const allActiveHifzEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.status, "active"),
  });
  const validEnrollments = allActiveHifzEnrollments.filter(e => hifzClassIds.includes(e.classId));
  const studentIds = validEnrollments.map(e => e.studentId);
  
  const studentClassMap = new Map(validEnrollments.map(e => [e.studentId, classMap.get(e.classId) ?? "Unknown"]));
  const studentEnrollmentMap = new Map(validEnrollments.map(e => [e.studentId, e]));

  let reportData: ReportRow[] = [];
  
  if (studentIds.length > 0) {
    const [studentList, targetsList, completionsList] = await Promise.all([
      db.query.students.findMany({
        where: eq(students.status, "active"),
        orderBy: [asc(students.firstName)],
      }),
      db.query.monthlyTargets.findMany({
        where: and(
          eq(monthlyTargets.year, year),
          eq(monthlyTargets.month, month)
        ),
      }),
      // Count juz completions per student this month
      db.query.juzTracker.findMany({
        where: and(
          between(juzTracker.completionDate!, monthStart, monthEnd)
        ),
      }),
    ]);

    const targetsMap = new Map(targetsList.map((t) => [t.studentId, parseFloat(String(t.targetJuz))]));
    const completionsMap = new Map<string, number>();
    for (const juz of completionsList) {
      if (studentIds.includes(juz.studentId)) {
        completionsMap.set(juz.studentId, (completionsMap.get(juz.studentId) ?? 0) + 1);
      }
    }

    reportData = studentList
      .filter((s) => studentIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        studentCode: s.studentCode,
        firstName: s.firstName,
        lastName: s.lastName,
        className: studentClassMap.get(s.id) ?? "Unknown",
        target: targetsMap.get(s.id) ?? getDefaultMonthlyTarget(studentEnrollmentMap.get(s.id)?.yearOfStudy),
        actual: completionsMap.get(s.id) ?? 0,
      }));
  }

  const toppersData = [...reportData]
    .filter((s) => s.target > 0 && s.actual >= s.target)
    .sort((a, b) => b.actual - a.actual || b.target - a.target || a.firstName.localeCompare(b.firstName));

  // Get juz completions per class for the bar chart
  const classStats = juzByClass.map((cls) => {
    const clsStudents = reportData.filter(r => r.className === cls.name);
    const completions = clsStudents.reduce((sum, s) => sum + s.actual, 0);
    return {
      className: cls.name,
      completions: completions,
      students: clsStudents.length,
    };
  });

  const totalJuz = juzThisMonth[0]?.count ?? 0;
  const maxCompletions = Math.max(...classStats.map((c) => c.completions), 1);

  const reportLinks = [
    { label: "Monthly Targets & Toppers", href: "/admin/hifz/targets", icon: "🎯", description: "View student progress vs targets" },
    { label: "Attendance Grid", href: "/admin/attendance", icon: "📋", description: "Monthly attendance by class" },
    { label: "Student List", href: "/admin/students", icon: "👥", description: "All enrolled students" },
    { label: "Applications", href: "/admin/admissions/applications", icon: "📝", description: "Admission pipeline status" },
    { label: "Activity Log", href: "/admin/settings/activity", icon: "🔍", description: "Full audit trail (super_admin)" },
  ];

  return (
    <div className="print:m-0 print:p-0">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description={`Summary for ${monthName}`}
          breadcrumbs={[{ label: "Admin" }, { label: "Reports" }]}
        />
      </div>

      {/* Period selector */}
      <form method="GET" className="flex gap-3 mb-6 items-end print:hidden">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Month</label>
          <select name="month" defaultValue={month}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString("en-IN", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Year</label>
          <select name="year" defaultValue={year}
            className="h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="submit" className="h-9 px-4 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors">
          View
        </button>
      </form>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 print:hidden">
        {[
          { label: "Active Students", value: activeStudents[0]?.count ?? 0 },
          { label: "Juz Completed", value: totalJuz, suffix: "this month" },
          { label: "Avg Juz/Student", value: (activeStudents[0]?.count ?? 0) > 0 ? (totalJuz / (activeStudents[0]?.count ?? 1)).toFixed(1) : "—" },
          { label: "Pending Applications", value: pendingApps[0]?.count ?? 0 },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className="font-playfair text-3xl font-semibold text-foreground">{value}</p>
            {suffix && <p className="text-xs text-muted-foreground mt-1">{suffix}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 print:hidden">
        {/* Juz completions by class — horizontal bar chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="font-playfair text-base font-semibold mb-4">
            Juz Completions by Class — {monthName}
          </h3>
          {classStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes found</p>
          ) : (
            <div className="space-y-3">
              {classStats.map((cls) => (
                <div key={cls.className}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{cls.className}</span>
                    <span className="font-jetbrains text-muted-foreground">{cls.completions} Juz</span>
                  </div>
                  <div className="h-6 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-sm transition-all"
                      style={{ width: `${(cls.completions / maxCompletions) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{cls.students} students</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toppers List */}
        <div className="lg:col-span-1">
          <ToppersList toppers={toppersData} month={monthName} />
        </div>
      </div>

      {/* Detailed Printable Report */}
      <div className="mb-8">
        <PrintableSortableReport data={reportData} monthName={monthName} />
      </div>

      {/* Quick links */}
      <div className="bg-card border border-border rounded-lg p-5 print:hidden">
        <h3 className="font-playfair text-base font-semibold mb-4">Detailed Reports</h3>
        <div className="space-y-2">
          {reportLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-3 border border-border rounded-sm hover:border-foreground/30 hover:bg-muted/30 transition-all group"
            >
              <span className="text-xl">{link.icon}</span>
              <div>
                <p className="text-sm font-medium text-foreground group-hover:underline">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
              <span className="ml-auto text-muted-foreground text-sm">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
