// Monthly Sabaq ranking for the Hifz roster (Tutor Hifz Entry + Bulk Entry).
// Metric: SUM(hifz_daily_entries.sabaq_pages) for the current calendar month in
// Asia/Kolkata, up to and including today. Sabaq Juz and Daura are revision and are not
// counted; remarks-only entries have null sabaq_pages and add nothing. The table has no
// soft-delete column, so there is nothing to exclude.
import { db } from "@/lib/db";
import { hifzDailyEntries } from "@/lib/db/schema";
import { and, gte, inArray, lte, sql } from "drizzle-orm";

export const INSTITUTION_TZ = "Asia/Kolkata";

/** YYYY-MM-DD for the given instant in the institution timezone. */
export function istDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INSTITUTION_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** First day of the current IST month through today (IST), as YYYY-MM-DD. */
export function currentMonthRange(now: Date = new Date()): { start: string; end: string } {
  const end = istDateString(now);
  return { start: `${end.slice(0, 7)}-01`, end };
}

/** One grouped query: studentId → total Sabaq pages this month. */
export async function getMonthlySabaqPages(
  studentIds: string[],
  now: Date = new Date()
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (studentIds.length === 0) return totals;
  const { start, end } = currentMonthRange(now);
  const rows = await db
    .select({
      studentId: hifzDailyEntries.studentId,
      pages: sql<string>`coalesce(sum(${hifzDailyEntries.sabaqPages}), 0)`,
    })
    .from(hifzDailyEntries)
    .where(
      and(
        inArray(hifzDailyEntries.studentId, studentIds),
        gte(hifzDailyEntries.date, start),
        lte(hifzDailyEntries.date, end)
      )
    )
    .groupBy(hifzDailyEntries.studentId);
  for (const r of rows) totals.set(r.studentId, Number(r.pages));
  return totals;
}

/** Highest pages first; ties (incl. zero) alphabetical by first then last name. */
export function rankByMonthlyPages<T extends { id: string; firstName: string; lastName: string | null }>(
  list: T[],
  totals: Map<string, number>
): (T & { monthlyPages: number; rank: number })[] {
  return list
    .map((s) => ({ ...s, monthlyPages: totals.get(s.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.monthlyPages - a.monthlyPages ||
        a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" }) ||
        (a.lastName ?? "").localeCompare(b.lastName ?? "", undefined, { sensitivity: "base" })
    )
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
