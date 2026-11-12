// Single source of truth for the valid Juz range. Plain module (no "use server"),
// imported by both the server actions and the client forms.
import { z } from "zod";

export const MIN_JUZ = 1;
export const MAX_JUZ = 30;
export const JUZ_RANGE_MESSAGE = `Juz must be a whole number between ${MIN_JUZ} and ${MAX_JUZ}`;

/** One Juz number: integer, 1–30 inclusive. */
export const juzNumberSchema = z
  .number({ message: JUZ_RANGE_MESSAGE })
  .int(JUZ_RANGE_MESSAGE)
  .min(MIN_JUZ, JUZ_RANGE_MESSAGE)
  .max(MAX_JUZ, JUZ_RANGE_MESSAGE);

export function isValidJuz(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= MIN_JUZ && n <= MAX_JUZ;
}

/** Message if any value is outside 1–30 (or not a whole number), otherwise null. */
export function findInvalidJuz(values: Array<number | null | undefined>): string | null {
  return values.some((v) => v !== null && v !== undefined && !isValidJuz(v)) ? JUZ_RANGE_MESSAGE : null;
}
