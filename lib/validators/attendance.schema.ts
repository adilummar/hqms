import { z } from "zod";

export const markAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  track: z.enum(["hifz", "madrasa", "school"]),
  date: z.string().min(1),
  status: z.enum(["present", "absent", "leave"]),
  leaveType: z.enum(["sick_leave", "casual_leave", "approved_leave"]).optional(),
  remarks: z.string().optional(),
});

export const bulkMarkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  track: z.enum(["hifz", "madrasa", "school"]),
  date: z.string().min(1),
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(["present", "absent", "leave"]),
      leaveType: z.enum(["sick_leave", "casual_leave", "approved_leave"]).optional(),
      remarks: z.string().optional(),
    })
  ),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;
