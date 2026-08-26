import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { hifzDailyEntries, enrollments, classes } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tutor Dashboard" };

export default async function TutorDashboard() {
  const session = await requireRole(["tutor", "admin", "super_admin"]);
  const today = new Date().toISOString().split("T")[0];

  // Get tutor's assigned classes
  const tutorClasses = await db.query.classes.findMany({
    where: and(
      eq(classes.tutorId, session.user.id),
      eq(classes.isActive, true)
    ),
  });

  const hifzClass = tutorClasses.find((c) => c.track === "hifz");

  // Count today's entries for tutor's class
  let todayEntries = 0;
  let totalStudents = 0;

  if (hifzClass) {
    const enrolledStudents = await db.query.enrollments.findMany({
      where: and(
        eq(enrollments.classId, hifzClass.id),
        eq(enrollments.status, "active")
      ),
    });
    totalStudents = enrolledStudents.length;

    if (totalStudents > 0) {
      const entries = await db
        .select({ count: count() })
        .from(hifzDailyEntries)
        .where(eq(hifzDailyEntries.date, today));
      todayEntries = entries[0]?.count ?? 0;
    }
  }

  const pendingEntries = Math.max(0, totalStudents - todayEntries);

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        description={`Today: ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}
        action={
          <Link
            href="/tutor/hifz"
            className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
          >
            Daily Hifz Entry →
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="My Students" value={totalStudents} description={hifzClass?.name ?? "No class assigned"} />
        <StatCard label="Entries Done" value={todayEntries} description="Today" />
        <StatCard label="Pending Entry" value={pendingEntries} description="Students without today&apos;s entry" />
      </div>

      {/* Progress ring visual */}
      {totalStudents > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="font-playfair text-lg font-semibold mb-4">Today&apos;s Entry Progress</h2>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E5E5" strokeWidth="2.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#111"
                  strokeWidth="2.5"
                  strokeDasharray={`${(todayEntries / totalStudents) * 100} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-jetbrains font-medium">
                  {totalStudents > 0 ? Math.round((todayEntries / totalStudents) * 100) : 0}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-playfair font-semibold">
                {todayEntries} / {totalStudents}
              </p>
              <p className="text-sm text-muted-foreground">Students entered today</p>
              {pendingEntries > 0 && (
                <Link
                  href="/tutor/hifz"
                  className="inline-block mt-3 text-sm text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Enter {pendingEntries} pending →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {!hifzClass && (
        <div className="bg-muted border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No Hifz class assigned. Contact an administrator to assign you to a class.
          </p>
        </div>
      )}
    </div>
  );
}
