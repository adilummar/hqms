import { z } from "zod";

export const markAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  track: z.enum(["hifz", "madrasa", "school"]),
  date: z.string().min(1),
  session: z.enum(["FN", "AN"]),
  status: z.enum(["present", "absent", "friday", "holiday", "unmarked"]),
  absenceReasonId: z.string().uuid().optional(),
}).refine(data => {
  if (data.status === "absent" && !data.absenceReasonId) return false;
  return true;
}, { message: "Absence reason is required when status is absent", path: ["absenceReasonId"] });

export const bulkMarkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  track: z.enum(["hifz", "madrasa", "school"]),
  date: z.string().min(1),
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      session: z.enum(["FN", "AN"]),
      status: z.enum(["present", "absent", "friday", "holiday", "unmarked"]),
      absenceReasonId: z.string().uuid().optional().or(z.literal("")),
    }).refine(data => {
      if (data.status === "absent" && !data.absenceReasonId) return false;
      return true;
    }, { message: "Absence reason is required when absent", path: ["absenceReasonId"] })
  ),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;
