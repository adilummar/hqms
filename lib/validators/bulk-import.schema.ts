/**
 * lib/validators/bulk-import.schema.ts
 * Validates each row of the student bulk-import Excel/CSV.
 * Matches exactly the columns available in the existing Excel file.
 */

import { z } from "zod";

/** Convert DD-MM-YYYY → YYYY-MM-DD.  Returns null if unparseable. */
export function parseDDMMYYYY(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  // 1. DD-MM-YYYY (your primary format: 25-02-2013)
  const ddmm = trimmed.match(/^(\d{1,2})[-](\d{1,2})[-](\d{4})$/);
  if (ddmm) {
    const [, dd, mm, yyyy] = ddmm;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // 2. DD/MM/YYYY (slash variant)
  const ddmmSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmSlash) {
    // Treat as DD/MM/YYYY (Indian format) — day is first
    const [, dd, mm, yyyy] = ddmmSlash;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // 3. YYYY-MM-DD (ISO — what xlsx sometimes outputs for date cells)
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return null;
}

export const bulkImportRowSchema = z.object({
  /** AD NO — the manual register admission number e.g. "150", "151" */
  adNo: z
    .string()
    .min(1, "AD NO is required")
    .transform((v) => v.trim()),

  firstName: z
    .string()
    .min(1, "First name is required")
    .transform((v) => v.trim()),

  fatherName: z
    .string()
    .min(1, "Father's name is required")
    .transform((v) => v.trim()),

  phone: z
    .string()
    .min(6, "Phone number is required")
    .max(15)
    .transform((v) => v.trim().replace(/\s+/g, "")),

  /** Address parts — all optional */
  houseName:  z.string().optional().transform((v) => v?.trim() || undefined),
  post:       z.string().optional().transform((v) => v?.trim() || undefined),
  district:   z.string().optional().transform((v) => v?.trim() || undefined),
  state:      z.string().optional().transform((v) => v?.trim() || undefined),
  pin:        z.string().optional().transform((v) => v?.trim() || undefined),

  /**
   * Date of birth in DD-MM-YYYY format (as it appears in the Excel).
   * Stored as YYYY-MM-DD in the DB.
   */
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine(
      (v) => parseDDMMYYYY(v) !== null,
      "Date of birth must be in DD-MM-YYYY format"
    )
    .transform((v) => parseDDMMYYYY(v)!),

  bloodGroup: z.string().optional().transform((v) => v?.trim() || undefined),

  /** Class names — matched to classes table by name */
  hifzClass:    z.string().min(1, "Hifz class is required").transform((v) => v.trim()),
  schoolClass:  z.string().min(1, "School class is required").transform((v) => v.trim()),
  madrasaClass: z.string().min(1, "Madrasa class is required").transform((v) => v.trim()),

  /** Batch number — matched to academicYears.batchNumber (integer) */
  batch: z
    .string()
    .min(1, "Batch is required")
    .transform((v) => parseInt(v.trim(), 10))
    .refine((v) => !isNaN(v) && v > 0, "Batch must be a positive number"),
});

export type BulkImportRow = z.infer<typeof bulkImportRowSchema>;

/** Result for each row after import attempt */
export interface BulkImportRowResult {
  rowIndex: number;      // 1-based row number
  adNo: string;
  firstName: string;
  status: "inserted" | "updated" | "conflict" | "error";
  message: string;
  suggestedAdNo?: string; // for conflict rows
  conflictStudentName?: string;
}
