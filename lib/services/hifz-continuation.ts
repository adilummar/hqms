// Where each student's previous Sabaq ended, for the "continued from pg X" indicator.
// Same rule the Individual entry page always used: the student's most recent entry dated
// BEFORE the selected date, and its sabaq_to_page (null if that entry has none).
// One query for any number of students (used by Individual with one id, Bulk with the class).
import { db } from "@/lib/db";
import { hifzDailyEntries } from "@/lib/db/schema";
import { and, desc, inArray, lt } from "drizzle-orm";

export async function getPreviousSabaqEnds(studentIds: string[], beforeDate: string): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (studentIds.length === 0) return out;
  const rows = await db
    .selectDistinctOn([hifzDailyEntries.studentId], {
      studentId: hifzDailyEntries.studentId,
      toPage: hifzDailyEntries.sabaqToPage,
    })
    .from(hifzDailyEntries)
    .where(and(inArray(hifzDailyEntries.studentId, studentIds), lt(hifzDailyEntries.date, beforeDate)))
    .orderBy(hifzDailyEntries.studentId, desc(hifzDailyEntries.date));
  for (const r of rows) out.set(r.studentId, r.toPage);
  return out;
}
