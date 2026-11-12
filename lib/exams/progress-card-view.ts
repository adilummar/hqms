// Presentation rules shared by every renderer of the progress card (HTML screen/print and PDF),
// so a card reads the same wherever it is produced. Pure module.
import type { CardTrackData } from "@/lib/exams/progress-card";

export const SECTION_TITLE: Record<CardTrackData["track"], string> = {
  hifz: "HIFZ EXAM RESULT",
  madrasa: "HIFZ MADRASA RESULT",
  school: "HIFZ SCHOOL RESULT",
};

/** Header label for a subject column, as printed on the paper card. */
export function columnLabel(track: CardTrackData["track"], name: string) {
  const n = name.trim().toLowerCase();
  if (track === "madrasa") {
    if (/lisan|لسان/.test(n)) return "لسان";
    if (/fiqh|فقه/.test(n)) return "فقه";
    if (/tar[ie]*kh|تاريخ/.test(n)) return "تاريخ";
    if (/duroos|durus|دروس/.test(n)) return "دروس";
  }
  if (track === "school") {
    if (/^eng/.test(n)) return "ENG";
    if (/^mal/.test(n)) return "MLM";
    if (/^hin/.test(n)) return "HND";
    if (/^(sci|evs)/.test(n)) return "SCI";
    if (/^(math|mts)/.test(n)) return "MTS";
  }
  return name.toUpperCase();
}

/** "2" → "2 Juz", "1.25" → "1.25 Juz"; anything non-numeric (a typed note) is left alone. */
export function juzDisplay(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  return /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()} Juz` : v;
}

/** The two label/value rows on the left of a track's header block. null value = unavailable. */
export function metaLeft(t: CardTrackData): [string, string | null][] {
  return t.track === "hifz"
    ? [
        ["Juz Memorized", juzDisplay(t.memorizedJuz)],
        ["Juz to be Obtained", juzDisplay(t.toBeObtained)],
      ]
    : [
        ["Standard", t.className],
        ["Class Teacher", t.teacher],
      ];
}

export const metaRight = (t: CardTrackData): [string, string][] => [
  ["Rank", t.rank === null ? "—" : String(t.rank)],
  ["Status", t.status],
];

/** Safe file name stem: "211-Ahammed-Nuhman". */
export function cardFileStem(admissionNumber: string, studentName: string): string {
  const clean = (s: string) =>
    s.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return [clean(admissionNumber), clean(studentName)].filter(Boolean).join("-") || "progress-card";
}

/** Makes names unique inside one ZIP: a, a → a, a-2 */
export function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  let i = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${name}-${i++}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
