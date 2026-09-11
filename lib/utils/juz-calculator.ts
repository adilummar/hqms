/**
 * juz-calculator.ts
 * 
 * Central utility for parsing page and juz progress according to HQMS business rules:
 * - Normal Juz = 20 pages
 * - Juz 29 = 24 pages
 * - Juz 30 = 24 pages
 * 
 * Exact Human labels for NORMAL Juz (20 pages):
 * - 5 pages = "0.25 Juz"
 * - 10 pages = "Half Juz"
 * - 15 pages = "0.75 Juz"
 * - 20 pages = "1 Juz"
 * 
 * For Juz 29/30 (24 pages), the label must reflect the exact fraction,
 * NEVER using "Half Juz" unless it precisely matches the business definition.
 */

export function getJuzDenominator(juzNumber: number | null | undefined): number {
  if (juzNumber === 29 || juzNumber === 30) return 24;
  return 20;
}

export function calculateJuzEquivalent(pages: number, juzNumber: number | null | undefined): number {
  const denominator = getJuzDenominator(juzNumber);
  return pages / denominator;
}

export function formatJuzEquivalent(pages: number, juzNumber: number | null | undefined): string {
  const denominator = getJuzDenominator(juzNumber);
  
  if (denominator === 20) {
    if (pages === 5) return "0.25 Juz";
    if (pages === 10) return "Half Juz";
    if (pages === 15) return "0.75 Juz";
    if (pages === 20) return "1 Juz";
  } else {
    // For Juz 29/30, fraction must be exact, e.g. 10/24 or calculated to precision.
    if (pages === 24) return "1 Juz";
    // We can display the exact fraction or exact decimal. The prompt asks to reflect the actual fraction.
    // E.g. "10/24 Juz" or "0.41 Juz"
    // Let's use the exact fraction text as requested in prompt: "10 pages in Juz 29/30 = 10/24 Juz"
    return `${pages}/24 Juz`;
  }
  
  // Fallback for non-standard page amounts in a 20-page Juz
  if (pages === denominator) return "1 Juz";
  
  // Return the decimal rounded to 2 places for non-standard amounts
  const eq = pages / denominator;
  return `${eq.toFixed(2).replace(/\.00$/, '')} Juz`;
}

/**
 * Aggregates multiple entries of pages/juz into a total numeric Juz Equivalent
 */
export function aggregateStudyToJuz(entries: { pages: number, juzNumber: number | null }[]): number {
  return entries.reduce((acc, entry) => acc + calculateJuzEquivalent(entry.pages, entry.juzNumber), 0);
}

/**
 * Calculates the exact number of pages required to fulfill an annual fractional Juz target,
 * crossing over Juz boundaries correctly and using specific lengths (20 or 24).
 * 
 * E.g. starting at Juz 29 Page 1 for 1.5 Juz target => 24 pages (Juz 29) + 12 pages (Juz 30) = 36 total pages.
 */
export function calculateJuzAwareTargetPath(startingJuz: number, startingPage: number, targetJuzAmount: number): number {
  let pages = 0;
  let remJuz = targetJuzAmount;
  let currJuz = startingJuz;
  let currPage = startingPage;

  while (remJuz > 0.0001) { // Floating point safety
    if (currJuz > 30) {
      // Reached the end of the Quran, target caps here
      break;
    }

    const denom = getJuzDenominator(currJuz);
    
    // Safety check in case the recorded starting page is invalid
    const actualCurrPage = Math.max(1, Math.min(currPage, denom));
    
    const pagesLeftInJuz = denom - actualCurrPage + 1;
    const juzFractionLeft = pagesLeftInJuz / denom;

    if (remJuz >= juzFractionLeft) {
      // Consume the rest of this Juz
      pages += pagesLeftInJuz;
      remJuz -= juzFractionLeft;
      currJuz++;
      currPage = 1; // start at beginning of next Juz
    } else {
      // Target ends within this Juz
      pages += remJuz * denom;
      remJuz = 0;
      break;
    }
  }

  // Fractional pages rule: Always ROUND UP to the next whole page for the operational target
  return Math.ceil(pages);
}
