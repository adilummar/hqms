"use server";

import { db } from "@/lib/db";
import { examSessions, juzTracker } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/helpers";
import { buildProgressCardData } from "@/lib/exams/progress-card";
import { getHifzResults } from "@/lib/exams/hifz-results";

export interface ProgressCardDefaults {
  /** Hifz section currently appears on this student's card */
  hasHifz: boolean;
  hasHifzClass: boolean;
  hasMadrasa: boolean;
  hasSchool: boolean;
  /** This examination has a Hifz session (Juz values can be recorded for it) */
  hifzSessionId: string | null;
  /** Hifz results are published → Juz values are locked and only usable for this print */
  hifzPublished: boolean;
  madrasaClass: string;
  schoolClass: string;
  /** Stored, exam-specific values ("" = not recorded) */
  toBeObtained: string;
  memorizedJuz: string;
  hifzRemarks: string;
  /** Hint only: Juz completed in daily Hifz progress. Never used as the exam value. */
  progressHint: number | null;
  mentor: string;
  madrasaTeacher: string;
  schoolTeacher: string;
}

/**
 * Pre-fills the "before generating" dialog: which tracks the student has in this
 * examination, the stored exam-specific Hifz values, and class tutor names. Admin only.
 */
export async function getProgressCardDefaults(examinationId: string, studentId: string) {
  await requireAdmin();
  const res = await buildProgressCardData(examinationId, studentId);
  if (!res.success) return { success: false as const, error: res.error };

  const hifzSession = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.examinationId, examinationId), eq(examSessions.track, "hifz")),
  });
  const stored = hifzSession ? (await getHifzResults(hifzSession.id, [studentId])).rows[0] : undefined;

  const completed = await db
    .select({ n: juzTracker.juzNumber })
    .from(juzTracker)
    .where(and(eq(juzTracker.studentId, studentId), eq(juzTracker.status, "completed")));

  const by = (t: string) => res.data.tracks.find((x) => x.track === t);
  const clean = (v?: string) => (v && v !== "—" ? v : "");
  const defaults: ProgressCardDefaults = {
    hasHifz: !!by("hifz"),
    hasHifzClass: res.data.header.hasHifzClass,
    hasMadrasa: !!by("madrasa"),
    hasSchool: !!by("school"),
    hifzSessionId: hifzSession?.id ?? null,
    hifzPublished: hifzSession?.resultStatus === "published",
    madrasaClass: by("madrasa")?.className ?? "",
    schoolClass: by("school")?.className ?? "",
    toBeObtained: stored?.juzToObtain != null ? String(stored.juzToObtain) : "",
    memorizedJuz: stored?.juzMemorized != null ? String(stored.juzMemorized) : "",
    hifzRemarks: stored?.remarks ?? "",
    progressHint: completed.length > 0 ? completed.length : null,
    mentor: clean(res.data.header.mentor),
    madrasaTeacher: clean(by("madrasa")?.teacher),
    schoolTeacher: clean(by("school")?.teacher),
  };
  return { success: true as const, defaults };
}
