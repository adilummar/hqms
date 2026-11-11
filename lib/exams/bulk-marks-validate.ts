// Pure helpers for Bulk Exam Mark Entry (shared by the client table and the server action).
// Rules mirror the existing mark storage: exam_marks.marks_obtained is numeric(6,2),
// so at most 2 decimals; a mark can never be negative or exceed the subject's total.

export const MARK_FORMAT = /^\d{1,4}(\.\d{1,2})?$/;

/** null = valid, otherwise a message. Empty input is "not entered", not an error. */
export function validateMarkText(text: string, maxMarks: number): string | null {
  const v = text.trim();
  if (v === "") return null;
  if (v.startsWith("-")) return "Marks cannot be negative";
  if (!MARK_FORMAT.test(v)) return "Enter a number (max 2 decimals)";
  if (Number(v) > maxMarks) return `Cannot exceed ${maxMarks}`;
  return null;
}

/** Canonical display for a stored numeric string: "77.00" → "77", "12.50" → "12.5", null → "". */
export function displayMark(stored: string | null | undefined): string {
  return stored === null || stored === undefined || stored === "" ? "" : String(Number(stored));
}

export interface RowState {
  value: string;
  absent: boolean;
}

export type RowStatus = "existing" | "modified" | "new" | "not_entered";

/**
 * Whether the row should be submitted. Only an explicit, valid change counts:
 * clearing an existing mark is NOT a change (bulk entry never deletes or blanks a mark).
 */
export function isChangedRow(orig: RowState | null, cur: RowState, maxMarks: number): boolean {
  const entered = cur.absent || cur.value.trim() !== "";
  if (!entered) return false;
  if (!cur.absent && validateMarkText(cur.value, maxMarks) !== null) return false;
  if (!orig) return true;
  if (cur.absent !== orig.absent) return true;
  return !cur.absent && Number(cur.value) !== Number(orig.value);
}

export function rowStatus(orig: RowState | null, cur: RowState, maxMarks: number): RowStatus {
  if (isChangedRow(orig, cur, maxMarks)) return orig ? "modified" : "new";
  return orig ? "existing" : "not_entered";
}
