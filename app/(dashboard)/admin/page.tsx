import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, admissionApplications, juzTracker, activityLogs } from "@/lib/db/schema";
import { eq, count, and, between, desc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Users, ClipboardList, BookOpen, CalendarCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
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
      db.select({ count: count() }).from(students).where(eq(students.status, "active")),
      db.select({ count: count() }).from(admissionApplications).where(eq(admissionApplications.status, "pending")),
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

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Overview for ${monthLabel}`}
      />

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Students"
          value={totalStudents[0]?.count ?? 0}
          description="Currently enrolled"
          icon={Users}
          accentColor="teal"
        />
        <StatCard
          label="Pending Applications"
          value={pendingApps[0]?.count ?? 0}
          description="Awaiting review"
          icon={ClipboardList}
          accentColor="amber"
        />
        <StatCard
          label="Juz Completions"
          value={juzCompletions[0]?.count ?? 0}
          description="This month"
          icon={BookOpen}
          accentColor="emerald"
        />
        <StatCard
          label="Present Today"
          value="—"
          description="Mark attendance to see"
          icon={CalendarCheck}
          accentColor="blue"
        />
      </div>

      {/* ── Bottom Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-inter text-[15px] font-semibold text-foreground tracking-tight">Recent Activity</h2>
              <p className="text-[12px] text-muted-foreground font-dm-sans mt-0.5">Latest system events</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
          </div>
          <div className="divide-y divide-border/60">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[13px] text-muted-foreground font-dm-sans">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((log) => (
                <div key={log.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors duration-150">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-lg bg-teal/10 ring-1 ring-teal/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-teal font-inter uppercase">
                      {log.user?.username?.charAt(0) ?? "?"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground font-medium font-dm-sans leading-snug">
                      {log.action.replace(/\./g, " → ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-dm-sans">
                      <span className="font-medium text-slate-500">{log.user?.username ?? "Unknown"}</span>
                      <span className="text-slate-300 mx-1.5">·</span>
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

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-inter text-[15px] font-semibold text-foreground tracking-tight">Quick Actions</h2>
            <p className="text-[12px] text-muted-foreground font-dm-sans mt-0.5">Common tasks at a glance</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {[
              { label: "Mark Attendance",   href: "/admin/attendance",              color: "teal" },
              { label: "Daily Hifz Entry",  href: "/admin/hifz",                   color: "emerald" },
              { label: "Add Student",       href: "/admin/admissions/new",          color: "blue" },
              { label: "View Applications", href: "/admin/admissions/applications", color: "amber" },
              { label: "Monthly Targets",   href: "/admin/hifz/targets",            color: "violet" },
              { label: "Reports",           href: "/admin/reports",                 color: "rose" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-slate-50/50 hover:bg-white hover:border-teal/30 hover:shadow-sm transition-all duration-200"
              >
                <span className="text-[13px] font-medium text-foreground font-dm-sans leading-tight">
                  {item.label}
                </span>
                <ArrowRight
                  size={13}
                  className="text-slate-300 group-hover:text-teal group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0"
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
