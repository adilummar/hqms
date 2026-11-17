// Display-only helpers for the Tutor Hifz overview table.
// Remarks never affect ranking or page totals - they only fill the "-" gaps.

export type RemarkLabelMap = ReadonlyMap<string, string>;

export interface EntryDisplayInput {
  sabaqFromPage?: string | null;
  sabaqToPage?: string | null;
  sabaqPages?: string | null;
  sabaqRemarksId?: string | null;
  sabaqJuzGiven?: boolean | null;
  sabaqJuzRemarksId?: string | null;
  dauraJuzNumbers?: number[] | null;
  dauraRemarksId?: string | null;
  daura2JuzNumbers?: number[] | null;
  daura2RemarksId?: string | null;
}

export const EMPTY_CELL = "\u2013";

/** Resolve a saved remark id to its configured label; unknown/deleted -> null (never the raw id). */
export function resolveRemark(id: string | null | undefined, labels: RemarkLabelMap): string | null {
  if (!id) return null;
  const label = labels.get(id)?.trim();
  return label ? label : null;
}

export function formatSabaq(entry: EntryDisplayInput | undefined, labels: RemarkLabelMap): string {
  if (!entry) return EMPTY_CELL;
  if (entry.sabaqFromPage && entry.sabaqToPage) return `${entry.sabaqFromPage}\u2192${entry.sabaqToPage}`;
  const pages = Number(entry.sabaqPages);
  if (Number.isFinite(pages) && pages > 0) return `${pages} ${pages === 1 ? "page" : "pages"}`;
  return resolveRemark(entry.sabaqRemarksId, labels) ?? EMPTY_CELL;
}

export type SabaqJuzDisplay = { kind: "given" | "not_given" | "empty"; text: string };

export function formatSabaqJuz(entry: EntryDisplayInput | undefined, labels: RemarkLabelMap): SabaqJuzDisplay {
  if (!entry) return { kind: "empty", text: EMPTY_CELL };
  if (entry.sabaqJuzGiven) return { kind: "given", text: "Given" };
  const reason = resolveRemark(entry.sabaqJuzRemarksId, labels);
  if (reason) return { kind: "not_given", text: reason };
  // Entry exists, Juz explicitly not given, no reason recorded.
  return entry.sabaqJuzGiven === false
    ? { kind: "not_given", text: "Not given" }
    : { kind: "empty", text: EMPTY_CELL };
}

export function formatDaura(entry: EntryDisplayInput | undefined, labels: RemarkLabelMap, hafiz = false): string {
  if (!entry) return EMPTY_CELL;
  const d1 = entry.dauraJuzNumbers?.length ? entry.dauraJuzNumbers : null;
  if (hafiz) {
    const d2 = entry.daura2JuzNumbers?.length ? entry.daura2JuzNumbers : null;
    const parts = [
      d1 ? `D1: Juz ${d1.join(", ")}` : null,
      d2 ? `D2: Juz ${d2.join(", ")}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(" \u00b7 ");
    const reasons = [
      resolveRemark(entry.dauraRemarksId, labels),
      resolveRemark(entry.daura2RemarksId, labels),
    ].filter((r, i, a): r is string => !!r && a.indexOf(r) === i);
    return reasons.length ? reasons.join(" \u00b7 ") : EMPTY_CELL;
  }
  if (d1) return `Juz ${d1.join(", ")}`;
  return resolveRemark(entry.dauraRemarksId, labels) ?? EMPTY_CELL;
}
