// Result-ranking categories. A student's category is their year of study (stored on the
// enrolment as "1st" / "2nd" / "3rd"), so classmates in HA / HB / HC can be ranked together
// with every other student of the same year, whichever class they sit in.

export const YEAR_CATEGORIES = [
  { key: "sub_junior", label: "Sub-Junior", year: "1st Year" },
  { key: "junior", label: "Junior", year: "2nd Year" },
  { key: "senior", label: "Senior", year: "3rd Year" },
] as const;

export type YearCategoryKey = (typeof YEAR_CATEGORIES)[number]["key"];

/** "1st" / "1" / "1st Year" → sub_junior, 2 → junior, 3 → senior; anything else → null. */
export function yearCategoryOf(yearOfStudy: string | null | undefined): YearCategoryKey | null {
  const n = parseInt((yearOfStudy ?? "").replace(/\D/g, ""), 10);
  return YEAR_CATEGORIES[n - 1]?.key ?? null;
}

/** Competition ranking (1, 2, 2, 4): equal scores share a rank. Input must be sorted descending. */
export function rankDescending<T>(sorted: T[], score: (t: T) => number): number[] {
  const out: number[] = [];
  sorted.forEach((t, i) => {
    out.push(i > 0 && score(t) === score(sorted[i - 1]) ? out[i - 1] : i + 1);
  });
  return out;
}
