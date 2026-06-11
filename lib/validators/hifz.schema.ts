import { z } from "zod";

export const dailyEntrySchema = z
  .object({
    studentId: z.string().uuid(),
    date: z.string().min(1, "Date is required"),

    // Sabaq — XOR with sabaqRemarksId
    sabaqFromPage: z.coerce.number().min(0).max(604).optional(),
    sabaqToPage: z.coerce.number().min(0).max(604).optional(),
    sabaqRemarksId: z.string().uuid().optional(),

    // Sabaq Juz
    sabaqJuzGiven: z.boolean(),
    sabaqJuzRemarksId: z.string().uuid().optional(),

    // Daura — XOR with dauraRemarksId
    dauraJuzNumbers: z.array(z.coerce.number().min(1).max(30)).optional(),
    dauraRemarksId: z.string().uuid().optional(),

    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Sabaq validation: pages XOR remarks
    const hasPages = data.sabaqFromPage !== undefined || data.sabaqToPage !== undefined;
    const hasRemarks = !!data.sabaqRemarksId;

    if (!hasPages && !hasRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sabaqRemarksId"],
        message: "Either enter sabaq pages or select a reason",
      });
    }

    if (hasPages && hasRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sabaqRemarksId"],
        message: "Cannot have both pages and a reason",
      });
    }

    if (hasPages) {
      if (data.sabaqFromPage === undefined || data.sabaqToPage === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sabaqToPage"],
          message: "Both from and to pages are required",
        });
      } else if (data.sabaqToPage <= data.sabaqFromPage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sabaqToPage"],
          message: "To page must be greater than from page",
        });
      }
    }

    // Sabaq Juz validation
    if (data.sabaqJuzGiven === false && !data.sabaqJuzRemarksId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sabaqJuzRemarksId"],
        message: "Select a reason if Sabaq Juz was not given",
      });
    }

    if (data.sabaqJuzGiven === true && data.sabaqJuzRemarksId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sabaqJuzRemarksId"],
        message: "Cannot have a reason if Sabaq Juz was given",
      });
    }

    // Daura validation: juz numbers XOR remarks
    const hasDaura = data.dauraJuzNumbers !== undefined && data.dauraJuzNumbers.length > 0;
    const hasDauraRemarks = !!data.dauraRemarksId;

    if (!hasDaura && !hasDauraRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dauraRemarksId"],
        message: "Either enter a Daura juz number or select a reason",
      });
    }

    if (hasDaura && hasDauraRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dauraRemarksId"],
        message: "Cannot have both a Daura juz and a reason",
      });
    }
  });

export const updateJuzEntrySchema = z.object({
  studentId: z.string().uuid(),
  juzNumber: z.number().min(1).max(30),
  startDate: z.string().optional(),
  completionDate: z.string().optional(),
  notes: z.string().optional(),
});

export const setMonthlyTargetSchema = z.object({
  studentId: z.string().uuid(),
  year: z.number().min(2020).max(2100),
  month: z.number().min(1).max(12),
  targetJuz: z.coerce.number().min(0.1).max(30),
  notes: z.string().optional(),
});

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>;
export type UpdateJuzEntryInput = z.infer<typeof updateJuzEntrySchema>;
export type SetMonthlyTargetInput = z.infer<typeof setMonthlyTargetSchema>;
