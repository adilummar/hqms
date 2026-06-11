import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, juzTracker, hifzDailyEntries, monthlyTargets, studentStars } from "@/lib/db/schema";
import { eq, and, between, count, desc, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { JuzGrid } from "@/components/hifz/juz-grid";
import { Progress } from "@/components/ui/progress";
import { StarSummary } from "@/components/stars/star-summary";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Child's Progress" };

export default async function ParentDashboard() {
  await requireParent();
  const studentId = await getParentStudentId();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [student, juzData, recentEntries, monthlyTarget, juzCompletions, starCounts] =
    await Promise.all([
      db.query.students.findFirst({
        where: eq(students.id, studentId),
        with: { enrollments: { with: { class: true } } },
      }),
      db.query.juzTracker.findMany({
        where: eq(juzTracker.studentId, studentId),
        orderBy: [asc(juzTracker.juzNumber)],
      }),
      db.query.hifzDailyEntries.findMany({
        where: and(
          eq(hifzDailyEntries.studentId, studentId),
          between(hifzDailyEntries.date, sevenDaysAgoStr, today)
        ),
        orderBy: [desc(hifzDailyEntries.date)],
        limit: 7,
      }),
      db.query.monthlyTargets.findFirst({
        where: and(
          eq(monthlyTargets.studentId, studentId),
          eq(monthlyTargets.year, now.getFullYear()),
          eq(monthlyTargets.month, now.getMonth() + 1)
        ),
      }),
      db.select({ count: count() }).from(juzTracker).where(
        and(
          eq(juzTracker.studentId, studentId),
          between(juzTracker.completionDate!, monthStart, monthEnd)
        )
      ),
      db.query.studentStars.findMany({
        where: eq(studentStars.studentId, studentId),
        columns: { type: true },
      }),
    ]);

  if (!student) {
    return <div className="text-muted-foreground">Student not found.</div>;
  }

  const juzCells = Array.from({ length: 30 }, (_, i) => {
    const entry = juzData.find((j) => j.juzNumber === i + 1);
    return {
      juzNumber: i + 1,
      status: (entry?.status ?? "not_started") as "not_started" | "in_progress" | "completed",
      startDate: entry?.startDate,
      completionDate: entry?.completionDate,
    };
  });

  const completedJuz = juzCells.filter((j) => j.status === "completed").length;
  const currentJuz = juzCells.find((j) => j.status === "in_progress");
  const actualJuz = juzCompletions[0]?.count ?? 0;
  const targetJuz = monthlyTarget ? parseFloat(String(monthlyTarget.targetJuz)) : 0;
  const progress = targetJuz > 0 ? Math.min(100, (actualJuz / targetJuz) * 100) : 0;
  const blueStars = starCounts.filter((s) => s.type === "blue").length;
  const blackStars = starCounts.filter((s) => s.type === "black").length;

  return (
    <div className="space-y-6">
      <PageHeader title="My Child's Progress" />

      {/* Hero card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          {student.photoUrl ? (
            <Image
              src={student.photoUrl}
              alt={student.firstName}
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-2xl font-playfair font-semibold text-foreground">
                {student.firstName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h2 className="font-playfair text-2xl font-semibold">
              {student.firstName} {student.lastName ?? ""}
            </h2>
            <p className="text-sm text-muted-foreground font-jetbrains mt-0.5">
              {student.studentCode}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>{completedJuz} Juz completed</span>
              {currentJuz && <span>Currently on Juz {currentJuz.juzNumber}</span>}
            </div>
            {/* Star summary on hero card */}
            {(blueStars > 0 || blackStars > 0) && (
              <div className="mt-3">
                <Link href="/parent/stars">
                  <StarSummary blue={blueStars} black={blackStars} size="sm" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Target */}
      {targetJuz > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-playfair text-lg font-semibold mb-4">
            {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} Target
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target</span>
              <span className="font-jetbrains">{targetJuz} Juz</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Achieved</span>
              <span className="font-jetbrains">{actualJuz} Juz</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}% complete</span>
              <span>{Math.max(0, targetJuz - actualJuz)} Juz remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* Juz Grid */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-playfair text-lg font-semibold mb-4">Juz Tracker</h3>
        <JuzGrid juzData={juzCells} readonly />
      </div>

      {/* Last 7 days */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-playfair text-lg font-semibold">Last 7 Days</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Sabaq Pages</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Sabaq Juz</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Daura Juz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                    No entries recorded this week
                  </td>
                </tr>
              ) : (
                recentEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3 font-jetbrains text-xs">{entry.date}</td>
                    <td className="px-5 py-3">
                      {entry.sabaqFromPage && entry.sabaqToPage
                        ? `${entry.sabaqFromPage} → ${entry.sabaqToPage}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {entry.sabaqJuzGiven === true ? "✓" : entry.sabaqJuzGiven === false ? "✗" : "—"}
                    </td>
                    <td className="px-5 py-3 font-jetbrains">
                      {entry.dauraJuzNumbers?.length ? `Juz ${entry.dauraJuzNumbers.join(", ")}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
