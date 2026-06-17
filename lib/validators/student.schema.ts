import { z } from "zod";

export const createStudentSchema = z.object({
  studentCode: z.string().min(1),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  dateOfBirth: z.string().min(1),
  gender: z.enum(["male", "female"]),
  bloodGroup: z.string().optional(),
  nationality: z.string().default("Indian"),
  religion: z.string().optional(),
  address: z.string().optional(),
  photoUrl: z.string().optional(),
  medicalNotes: z.string().optional(),
  emergencyContact: z.string().optional(),
  admissionDate: z.string().min(1),
  admissionYearId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const updateStudentSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  // Structured address
  houseName: z.string().optional(),
  post: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pin: z.string().optional(),
  // Legacy combined (auto-built)
  address: z.string().optional(),
  photoUrl: z.string().optional(),
  medicalNotes: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const updateStudentStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "completed", "discontinued"]),
  completionDate: z.string().optional(),
  discontinuationDate: z.string().optional(),
  discontinuationReason: z.string().optional(),
});

export const studentFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "completed", "discontinued", "all"]).default("active"),
  hifzClassId: z.string().uuid().optional(),
  madrasaClassId: z.string().uuid().optional(),
  schoolClassId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  gender: z.enum(["male", "female", "all"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type UpdateStudentStatusInput = z.infer<typeof updateStudentStatusSchema>;
export type StudentFilterInput = z.infer<typeof studentFilterSchema>;
