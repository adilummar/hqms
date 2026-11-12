// Single source of truth for Sabaq page maths, used by the Individual entry form, the Bulk
// entry form and the server actions. Pure module (safe on client and server).
//
// Rule: the page range is INCLUSIVE of both ends — Total = To − From + 1
// (5→10 = 6, 1→1 = 1, 19→20 = 2).

/** Existing hard page limit already used by lib/validators/hifz.schema.ts */
export const MAX_SABAQ_PAGE = 604;

const parse = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

/** "" when the range is incomplete or reversed (same behaviour the Individual form always had). */
export function calcSabaqPages(from: string | number | null | undefined, to: string | number | null | undefined): string {
  const f = parse(from);
  const t = parse(to);
  return f !== null && t !== null && t >= f ? (t - f + 1).toString() : "";
}

/** Error message for an invalid From/To pair, or null. Half-entered ranges are not an error here. */
export function validateSabaqRange(from: string | number | null | undefined, to: string | number | null | undefined): string | null {
  const f = parse(from);
  const t = parse(to);
  if ((from !== null && from !== undefined && from !== "" && f === null) || (to !== null && to !== undefined && to !== "" && t === null))
    return "Pages must be numbers";
  if ((f !== null && f < 0) || (t !== null && t < 0)) return "Pages cannot be negative";
  if ((f !== null && f > MAX_SABAQ_PAGE) || (t !== null && t > MAX_SABAQ_PAGE)) return `Pages cannot exceed ${MAX_SABAQ_PAGE}`;
  if (f !== null && t !== null && t < f) return "To page cannot be before From page";
  return null;
}

/**
 * Value to store in sabaq_pages.
 * - Bulk entry (`authoritative`): always derived from From/To.
 * - Individual entry: the tutor may type a different total, so a supplied value is kept;
 *   it is only derived when missing.
 */
export function resolveSabaqPages(
  from: string | number | null | undefined,
  to: string | number | null | undefined,
  supplied: string | null | undefined,
  authoritative: boolean
): string | null {
  const computed = calcSabaqPages(from, to);
  if (authoritative) return computed || null;
  if (supplied !== null && supplied !== undefined && supplied !== "") return supplied;
  return computed || null;
}

/**
 * Suggested From page after a previous Sabaq ended on `lastTo`
 * (existing Individual-entry rule): a half-page end (14.5) continues on the SAME page,
 * a whole-page end (14) continues on the NEXT page (15). Informational only.
 */
export function continuationFromPage(lastTo: string | number | null | undefined): string | undefined {
  const last = parse(lastTo);
  if (last === null || lastTo === "" || !lastTo) return undefined;
  return (last % 1 === 0 ? last + 1 : last).toString();
}
