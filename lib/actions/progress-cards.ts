"use server";

import { requireAdmin } from "@/lib/auth/helpers";
import { buildProgressCardData } from "@/lib/exams/progress-card";

export interface ProgressCardDefaults {
  hasHifz: boolean;
  hasHifzClass: boolean;
  hasMadrasa: boolean;
  hasSchool: boolean;
  madrasaClass: string;
  schoolClass: string;
  memorizedJuz: string;
  mentor: string;
  madrasaTeacher: string;
  schoolTeacher: string;
}

/**
 * Pre-fills the "before generating" dialog: which tracks the student has in this
 * examination, plus best-guess values (class tutor names, completed Juz count).
 * Admin only.
 */
export async function getProgressCardDefaults(examinationId: string, studentId: string) {
  await requireAdmin();
  const res = await buildProgressCardData(examinationId, studentId);
  if (!res.success) return { success: false as const, error: res.error };

  const by = (t: string) => res.data.tracks.find((x) => x.track === t);
  const clean = (v?: string) => (v && v !== "—" ? v : "");
  const defaults: ProgressCardDefaults = {
    hasHifz: !!by("hifz"),
    hasHifzClass: res.data.header.hasHifzClass,
    hasMadrasa: !!by("madrasa"),
    hasSchool: !!by("school"),
    madrasaClass: by("madrasa")?.className ?? "",
    schoolClass: by("school")?.className ?? "",
    memorizedJuz: by("hifz")?.memorizedJuz ?? "",
    mentor: clean(res.data.header.mentor),
    madrasaTeacher: clean(by("madrasa")?.teacher),
    schoolTeacher: clean(by("school")?.teacher),
  };
  return { success: true as const, defaults };
}
