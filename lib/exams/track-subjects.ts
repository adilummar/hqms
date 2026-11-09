import { db } from "@/lib/db";
import { examTrackSubjects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface TrackSubjectOption {
  id: string;
  name: string;
  totalMarks: number;
  passMarks: number;
}

/**
 * Per-track subject list (admin-managed). Returns `ready: false` instead of
 * throwing when migration 0009 has not been applied yet, so the exam page
 * keeps working before the table exists.
 */
export async function getTrackSubjectCatalogue(
  track: "school" | "madrasa" | "hifz"
): Promise<{ ready: boolean; subjects: TrackSubjectOption[] }> {
  try {
    const rows = await db
      .select()
      .from(examTrackSubjects)
      .where(eq(examTrackSubjects.track, track))
      .orderBy(examTrackSubjects.displayOrder, examTrackSubjects.name);
    return {
      ready: true,
      subjects: rows.map((r) => ({ id: r.id, name: r.name, totalMarks: r.totalMarks, passMarks: r.passMarks })),
    };
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if (e?.code === "42P01" || e?.cause?.code === "42P01") return { ready: false, subjects: [] };
    throw err;
  }
}
