import { db } from "@/lib/db";
import { 
  studentAnnualHifzTargets, 
  academicYears, 
  hifzDailyEntries 
} from "@/lib/db/schema";
import { eq, and, gte, lte, isNotNull, sql } from "drizzle-orm";

export interface HifzTargetMetrics {
  annualTargetPages: number;
  weeklyTargetPages: number;
  cumulativeTargetPages: number;
  
  weeklyActualPages: number;
  cumulativeActualPages: number;

  weeklyAchievementPercent: number;
  cumulativeAchievementPercent: number;
}

export async function getStudentTargetMetrics(
  studentId: string, 
  academicYearId: string, 
  weekStartDate: Date, 
  weekEndDate: Date
): Promise<HifzTargetMetrics | null> {
  const acYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.id, academicYearId)
  });
  if (!acYear) return null;

  const target = await db.query.studentAnnualHifzTargets.findFirst({
    where: and(
      eq(studentAnnualHifzTargets.studentId, studentId),
      eq(studentAnnualHifzTargets.academicYearId, academicYearId)
    )
  });
  if (!target) return null;

  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  const durationMs = acYear.endDate.getTime() - acYear.startDate.getTime();
  const effectiveWeeks = durationMs / msInWeek;
  
  if (effectiveWeeks <= 0) return null;

  const weeklyTargetPages = target.calculatedTotalPages / effectiveWeeks;

  // Determine which week of the academic year we are currently in to get cumulative target
  const msSinceStartToWeekEnd = weekEndDate.getTime() - acYear.startDate.getTime();
  const weeksPassed = Math.max(0, msSinceStartToWeekEnd / msInWeek);
  
  const cumulativeTargetPages = weeklyTargetPages * weeksPassed;

  // Actual progress in the given week (Sabaq Pages only)
  const weeklyResult = await db
    .select({ total: sql<number>`sum(${hifzDailyEntries.sabaqPages})` })
    .from(hifzDailyEntries)
    .where(
      and(
        eq(hifzDailyEntries.studentId, studentId),
        gte(hifzDailyEntries.date, weekStartDate.toISOString().split('T')[0]),
        lte(hifzDailyEntries.date, weekEndDate.toISOString().split('T')[0]),
        isNotNull(hifzDailyEntries.sabaqPages)
      )
    );
  const weeklyActualPages = Number(weeklyResult[0]?.total ?? 0);

  // Cumulative progress since start of academic year up to weekEndDate
  const cumulativeResult = await db
    .select({ total: sql<number>`sum(${hifzDailyEntries.sabaqPages})` })
    .from(hifzDailyEntries)
    .where(
      and(
        eq(hifzDailyEntries.studentId, studentId),
        gte(hifzDailyEntries.date, acYear.startDate.toISOString().split('T')[0]),
        lte(hifzDailyEntries.date, weekEndDate.toISOString().split('T')[0]),
        isNotNull(hifzDailyEntries.sabaqPages)
      )
    );
  const cumulativeActualPages = Number(cumulativeResult[0]?.total ?? 0);

  const weeklyAchievementPercent = weeklyTargetPages > 0 
    ? (weeklyActualPages / weeklyTargetPages) * 100 
    : 0;

  const cumulativeAchievementPercent = cumulativeTargetPages > 0
    ? (cumulativeActualPages / cumulativeTargetPages) * 100
    : 0;

  return {
    annualTargetPages: target.calculatedTotalPages,
    weeklyTargetPages,
    cumulativeTargetPages,
    weeklyActualPages,
    cumulativeActualPages,
    weeklyAchievementPercent,
    cumulativeAchievementPercent,
  };
}
