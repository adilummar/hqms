import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";
import { PageHeader } from "@/components/layout/page-header";
import { StudentLoginToggle } from "@/components/settings/student-login-toggle";
import { ChangeOwnPasswordForm } from "@/components/settings/change-own-password-form";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["super_admin", "admin"]);

  const [allSettings, userCount] = await Promise.all([
    db.query.settings.findMany(),
    db.select().from(users),
  ]);

  const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));

  const settingSections = [
    {
      title: "Academic Year",
      description: "Manage academic years and promote students to the next year of study",
      href: "/admin/settings/academic-year",
      icon: "🎓",
    },
    {
      title: "Remarks Manager",
      description: "Manage dropdown options for Sabaq, Sabaq Juz, Daura, and Attendance remarks",
      href: "/admin/settings/remarks",
      icon: "📝",
    },
    {
      title: "Class Manager",
      description: "Add, rename, and manage classes for all three tracks",
      href: "/admin/settings/classes",
      icon: "🏫",
    },
    {
      title: "Monthly Targets",
      description: "Set default monthly Juz targets by year of study",
      href: "/admin/settings/targets",
      icon: "🎯",
    },
    {
      title: "User Management",
      description: `Manage admin, tutor, and parent accounts (${userCount.length} total)`,
      href: "/admin/settings/users",
      icon: "👥",
    },
    {
      title: "Parent Meetings",
      description: "Schedule whole-school parent-teacher meetings and track attendance",
      href: "/admin/settings/parent-meetings",
      icon: "🤝",
    },
    {
      title: "Activity Log",
      description: "View full audit trail of all system actions",
      href: "/admin/settings/activity",
      icon: "📋",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="System configuration and management"
        breadcrumbs={[{ label: "Admin" }, { label: "Settings" }]}
      />

      {/* System status */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h3 className="font-playfair text-base font-semibold mb-4">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Academic Year</p>
            <p className="font-medium font-jetbrains">
              {settingsMap.get("current_academic_year") ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Student Login</p>
            <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
              settingsMap.get("student_login_enabled") === "true"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-muted text-muted-foreground border border-border"
            }`}>
              {settingsMap.get("student_login_enabled") === "true" ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Attendance Threshold</p>
            <p className="font-medium font-jetbrains">
              {settingsMap.get("low_attendance_threshold") ?? "75"}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Total Users</p>
            <p className="font-medium font-jetbrains">{userCount.length}</p>
          </div>
        </div>
      </div>

      {/* Student Login Toggle */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h3 className="font-playfair text-base font-semibold mb-1">Portal Access Control</h3>
        <p className="text-xs text-muted-foreground mb-4">Control whether students can log into the student portal to view their published results.</p>
        <StudentLoginToggle
          initialEnabled={settingsMap.get("student_login_enabled") === "true"}
        />
      </div>

      {/* Change Own Password */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h3 className="font-playfair text-base font-semibold mb-1">Change Your Password</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Update your admin account password. You must enter your current password to confirm.
        </p>
        <ChangeOwnPasswordForm />
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="bg-card border border-border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all group"
          >
            <div className="text-2xl mb-3">{section.icon}</div>
            <h3 className="font-playfair text-base font-semibold text-foreground group-hover:underline mb-1">
              {section.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Monthly targets summary */}
      <div className="bg-card border border-border rounded-lg p-5 mt-6">
        <h3 className="font-playfair text-base font-semibold mb-4">Default Monthly Targets</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { year: "1st Year", key: "hifz_year1_monthly_target" },
            { year: "2nd Year", key: "hifz_year2_monthly_target" },
            { year: "3rd Year", key: "hifz_year3_monthly_target" },
          ].map(({ year, key }) => (
            <div key={key} className="text-center p-4 border border-border rounded-sm">
              <p className="text-muted-foreground text-xs mb-1">{year}</p>
              <p className="font-playfair text-2xl font-semibold">
                {settingsMap.get(key) ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">Juz / month</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
