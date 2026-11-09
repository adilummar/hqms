// Exam-specific Hifz values (Juz to be obtained / Juz memorized). Plain module, not a Server Action file.
// Requires migration 0010_exam_hifz_results.sql; every read degrades to "not recorded" when the
// table does not exist yet, so progress cards keep working before the migration is applied.
import { db } from "@/lib/db";
import { examHifzResults, examSessions } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export interface HifzResultRow {
  studentId: string;
  /** null = not recorded */
  juzToObtain: number | null;
  juzMemorized: number | null;
  remarks: string | null;
}

export const HIFZ_MIGRATION_MSG =
  "Hifz Juz entry is not set up yet. Run the 0010 migration (scripts/migrate-exam-hifz-results.ts).";

export function isMissingTable(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

const toNum = (v: string | null) => (v === null ? null : Number(v));

/** Stored Hifz values for the given students in ONE Hifz exam session. */
export async function getHifzResults(
  examSessionId: string,
  studentIds: string[]
): Promise<{ ready: boolean; rows: HifzResultRow[] }> {
  if (studentIds.length === 0) return { ready: true, rows: [] };
  try {
    const rows = await db
      .select()
      .from(examHifzResults)
      .where(and(eq(examHifzResults.examSessionId, examSessionId), inArray(examHifzResults.studentId, studentIds)));
    return {
      ready: true,
      rows: rows.map((r) => ({
        studentId: r.studentId,
        juzToObtain: toNum(r.juzToObtain),
        juzMemorized: toNum(r.juzMemorized),
        remarks: r.remarks,
      })),
    };
  } catch (err) {
    if (isMissingTable(err)) return { ready: false, rows: [] };
    throw err;
  }
}

export type SaveHifzInput = {
  studentId: string;
  juzToObtain: number | null;
  juzMemorized: number | null;
  remarks: string | null;
};

/** Validates a Juz value: null, or a number 0–30 in steps of 0.5. Returns an error string or null. */
export function validateJuz(label: string, v: number | null): string | null {
  if (v === null) return null;
  if (!Number.isFinite(v) || v < 0 || v > 30) return `${label} must be between 0 and 30`;
  if (Math.round(v * 2) !== v * 2) return `${label} must be a whole or half Juz (e.g. 19 or 19.5)`;
  return null;
}

/**
 * Upserts Hifz values for students of ONE Hifz session. Refuses non-Hifz sessions and published
 * sessions (same lock as mark entry). A row with nothing in it removes that student's record.
 */
export async function saveHifzResults(
  examSessionId: string,
  rows: SaveHifzInput[],
  userId: string
): Promise<{ success: true; saved: number } | { success: false; error: string }> {
  const session = await db.query.examSessions.findFirst({ where: eq(examSessions.id, examSessionId) });
  if (!session) return { success: false, error: "Exam session not found" };
  if (session.track !== "hifz") return { success: false, error: "Juz values can only be recorded for a Hifz exam" };
  if (session.resultStatus === "published") {
    return { success: false, error: "Results are published and locked. Unpublish them to change Juz values." };
  }

  for (const r of rows) {
    const e = validateJuz("Juz to be obtained", r.juzToObtain) ?? validateJuz("Juz memorized", r.juzMemorized);
    if (e) return { success: false, error: e };
    if (r.remarks && r.remarks.length > 300) return { success: false, error: "Remarks must be 300 characters or fewer" };
  }

  try {
    let saved = 0;
    await db.transaction(async (tx) => {
      for (const r of rows) {
        const remarks = r.remarks?.trim() || null;
        if (r.juzToObtain === null && r.juzMemorized === null && !remarks) {
          await tx
            .delete(examHifzResults)
            .where(and(eq(examHifzResults.examSessionId, examSessionId), eq(examHifzResults.studentId, r.studentId)));
          continue;
        }
        const values = {
          juzToObtain: r.juzToObtain === null ? null : String(r.juzToObtain),
          juzMemorized: r.juzMemorized === null ? null : String(r.juzMemorized),
          remarks,
          enteredBy: userId,
          updatedAt: new Date(),
        };
        await tx
          .insert(examHifzResults)
          .values({ examSessionId, studentId: r.studentId, ...values })
          .onConflictDoUpdate({ target: [examHifzResults.examSessionId, examHifzResults.studentId], set: values });
        saved++;
      }
    });
    return { success: true, saved };
  } catch (err) {
    if (isMissingTable(err)) return { success: false, error: HIFZ_MIGRATION_MSG };
    console.error("[saveHifzResults]", err);
    return { success: false, error: "Failed to save Juz values" };
  }
}
