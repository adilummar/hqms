import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, admissionApplications, juzTracker, activityLogs } from "@/lib/db/schema";
import { eq, count, and, between, desc, sql } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  await requireAdmin();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [totalStudents, pendingApps, juzCompletions, recentActivity] =
    await Promise.all([
      db.select({ count: count() }).from(students).where(eq(sql`${students.status}::text`, "active")),
      db.select({ count: count() }).from(admissionApplications).where(eq(sql`${admissionApplications.status}::text`, "pending")),
      db.select({ count: count() }).from(juzTracker).where(
        and(
          between(juzTracker.completionDate!, monthStart, monthEnd)
        )
      ),
      db.query.activityLogs.findMany({
        with: { user: true },
        orderBy: [desc(activityLogs.createdAt)],
        limit: 8,
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Students"
          value={totalStudents[0]?.count ?? 0}
          description="Currently enrolled"
        />
        <StatCard
          label="Pending Applications"
          value={pendingApps[0]?.count ?? 0}
          description="Awaiting review"
        />
        <StatCard
          label="Juz Completions"
          value={juzCompletions[0]?.count ?? 0}
          description="This month"
        />
        <StatCard
          label="Present Today"
          value="—"
          description="Mark attendance to see"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-playfair text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                No recent activity
              </div>
            ) : (
              recentActivity.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-foreground uppercase">
                      {log.user?.username?.charAt(0) ?? "?"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium">
                      {log.action.replace(/\./g, " → ")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.user?.username ?? "Unknown"} ·{" "}
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-playfair text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { label: "Mark Attendance", href: "/admin/attendance" },
              { label: "Daily Hifz Entry", href: "/admin/hifz" },
              { label: "Add Student", href: "/admin/admissions/new" },
              { label: "View Applications", href: "/admin/admissions/applications" },
              { label: "Monthly Targets", href: "/admin/hifz/targets" },
              { label: "Reports", href: "/admin/reports" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-4 py-3 border border-border rounded-sm text-sm font-medium text-foreground hover:bg-muted transition-colors text-center"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
