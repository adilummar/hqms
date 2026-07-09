import { requireParent, getParentStudentId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { students, hifzDailyEntries } from "@/lib/db/schema";
import { eq, desc, and, gte, lte, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSelector } from "@/components/parent/month-selector";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hifz Progress | Parent Portal" };

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function ParentProgressPage({ searchParams }: Props) {
  await requireParent();
  const studentId = await getParentStudentId();
  const params = await searchParams;

  const now = new Date();
  const selectedYear = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const selectedMonth = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [student, monthEntries, firstEntry] = await Promise.all([
    db.query.students.findFirst({
      where: eq(students.id, studentId),
    }),
    db.query.hifzDailyEntries.findMany({
      where: and(
        eq(hifzDailyEntries.studentId, studentId),
        gte(hifzDailyEntries.date, startDate),
        lte(hifzDailyEntries.date, endDate),
      ),
      orderBy: [desc(hifzDailyEntries.date)],
      with: {
        sabaqRemarks: true,
        sabaqJuzRemarks: true,
        dauraRemarks: true,
      },
    }),
    db.query.hifzDailyEntries.findFirst({
      where: eq(hifzDailyEntries.studentId, studentId),
      orderBy: [asc(hifzDailyEntries.date)],
      columns: { date: true },
    }),
  ]);

  if (!student) {
    return <div className="text-muted-foreground">Student not found.</div>;
  }

  const totalEntries = monthEntries.length;
  let totalSabaqPages = 0;
  let sabaqJuzGivenCount = 0;
  let dauraGivenCount = 0;

  for (const entry of monthEntries) {
    if (entry.sabaqPages) totalSabaqPages += Number(entry.sabaqPages);
    if (entry.sabaqJuzGiven) sabaqJuzGivenCount++;
    if (entry.dauraJuzNumbers?.length) dauraGivenCount++;
  }

  const avgPagesPerDay = totalEntries > 0 ? (totalSabaqPages / totalEntries).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detailed Hifz Progress"
        description="View your child's complete daily Hifz log"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Daily Logs This Month</p>
          <span className="text-3xl font-jetbrains font-bold text-foreground">{totalEntries}</span>
        </div>
        <div className="bg-card border border-border p-5 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Avg. Sabaq Pages/Day</p>
          <span className="text-3xl font-jetbrains font-bold text-[#C9A84C]">{avgPagesPerDay}</span>
        </div>
        <div className="bg-card border border-border p-5 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Sabaq Juz Regularity</p>
          <span className="text-3xl font-jetbrains font-bold text-foreground">
            {totalEntries > 0 ? Math.round((sabaqJuzGivenCount / totalEntries) * 100) : 0}%
          </span>
        </div>
        <div className="bg-card border border-border p-5 rounded-lg">
          <p className="text-sm text-muted-foreground font-medium mb-1">Daura Regularity</p>
          <span className="text-3xl font-jetbrains font-bold text-foreground">
            {totalEntries > 0 ? Math.round((dauraGivenCount / totalEntries) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-playfair text-lg font-semibold">Full Daily Log</h3>
          <MonthSelector
            currentYear={selectedYear}
            currentMonth={selectedMonth}
            minDate={firstEntry?.date}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Sabaq (Pages)</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Sabaq Juz</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Daura Juz</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Teacher Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No entries recorded for this month.
                  </td>
                </tr>
              ) : (
                monthEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-jetbrains text-xs whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-5 py-3">
                      {entry.sabaqFromPage && entry.sabaqToPage ? (
                        <div className="flex flex-col">
                          <span className="font-medium">Pages {entry.sabaqFromPage} → {entry.sabaqToPage}</span>
                          <span className="text-xs text-muted-foreground">({entry.sabaqPages} pages)</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {entry.sabaqJuzGiven === true ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-medium">
                          Completed
                        </span>
                      ) : entry.sabaqJuzGiven === false ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 text-red-800 text-xs font-medium">
                          Missed
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {entry.dauraJuzNumbers?.length ? (
                        <span className="font-jetbrains font-medium bg-muted/50 px-2 py-1 rounded-md border border-border">
                          Juz {entry.dauraJuzNumbers.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 max-w-[200px] truncate text-xs text-muted-foreground">
                      {entry.notes || "—"}
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
