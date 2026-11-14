import { z } from "zod";

/** Pure (client + server safe) helpers for staff-meeting category & participants. */

export const MEETING_CATEGORIES = ["school", "madrasa", "management", "custom"] as const;
export type MeetingCategory = (typeof MEETING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MeetingCategory, string> = {
  school: "School",
  madrasa: "Madrasa",
  management: "Management",
  custom: "Custom",
};

export const CUSTOM_CATEGORY_MAX = 100;

/** Display label. Legacy meetings (no category) return null. */
export function categoryLabel(
  category: string | null | undefined,
  customCategory?: string | null
): string | null {
  if (!category) return null;
  if (category === "custom") return customCategory?.trim() || "Custom";
  return CATEGORY_LABELS[category as MeetingCategory] ?? null;
}

/**
 * Normalises a category selection. The custom text is only kept when the
 * category is "custom"; switching to any other category discards it.
 */
export function normalizeCategory(input: {
  category: MeetingCategory;
  customCategory?: string | null;
}): { category: MeetingCategory; customCategory: string | null } {
  if (input.category !== "custom") return { category: input.category, customCategory: null };
  return { category: "custom", customCategory: (input.customCategory ?? "").trim() };
}

export const categoryFields = {
  category: z.enum(MEETING_CATEGORIES, { error: "Select a meeting category" }),
  customCategory: z.string().max(CUSTOM_CATEGORY_MAX * 2).optional().nullable(),
};

/** Adds the "custom requires a description" rule to an object schema's refinement. */
export function validateCustomCategory(
  v: { category: MeetingCategory; customCategory?: string | null },
  ctx: z.RefinementCtx
) {
  if (v.category === "custom") {
    const t = (v.customCategory ?? "").trim();
    if (!t) {
      ctx.addIssue({
        code: "custom",
        path: ["customCategory"],
        message: "Specify the meeting category",
      });
    } else if (t.length > CUSTOM_CATEGORY_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["customCategory"],
        message: `Category must be at most ${CUSTOM_CATEGORY_MAX} characters`,
      });
    }
  }
}

// ── External participants ────────────────────────────────────────────────────

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export const externalParticipantSchema = z.object({
  id: z.string().uuid().optional(), // present when editing a saved participant
  name: z
    .string()
    .transform(collapse)
    .pipe(z.string().min(2, "Name is required (min 2 characters)").max(120)),
  designation: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? collapse(v) || null : null)),
  contactNumber: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v ? collapse(v) || null : null))
    .refine((v) => v === null || /^[0-9+()\-\s.]{5,40}$/.test(v), "Invalid contact number"),
});
export type ExternalParticipantInput = z.input<typeof externalParticipantSchema>;
export type ExternalParticipant = z.output<typeof externalParticipantSchema>;

/** Identity used to detect duplicates within one meeting. */
export function externalKey(p: { name: string; designation?: string | null }): string {
  return `${collapse(p.name).toLowerCase()}|${collapse(p.designation ?? "").toLowerCase()}`;
}

export function findDuplicateExternal(
  list: { name: string; designation?: string | null }[]
): string | null {
  const seen = new Set<string>();
  for (const p of list) {
    const k = externalKey(p);
    if (seen.has(k)) return collapse(p.name);
    seen.add(k);
  }
  return null;
}

export const participantsSchema = z.object({
  participantUserIds: z.array(z.string().uuid()).max(500),
  externalParticipants: z.array(externalParticipantSchema).max(100),
});

/** Row shape shared by the attendance sheet / print view. */
export interface MeetingAttendee {
  /** Stable key: user id for registered staff, `ext:<id>` for external. */
  key: string;
  kind: "staff" | "external";
  userId: string | null;
  externalId: string | null;
  username: string;
  email?: string | null;
  role: string;
  designation?: string | null;
  contactNumber?: string | null;
  attended: boolean;
  remarks: string | null;
}
