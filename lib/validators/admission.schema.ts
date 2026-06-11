import { z } from "zod";

const uploadedFilePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("/uploads/") || z.string().url().safeParse(value).success,
    "File upload is required"
  );

export const applicationFormSchema = z.object({
  // Step 1 — Personal Details
  applicantName: z.string().min(2, "Full name is required"),
  fatherName: z.string().min(2, "Father's name is required"),
  fatherOccupation: z.string().min(2, "Father's occupation is required"),
  motherName: z.string().min(2, "Mother's name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  photoUrl: uploadedFilePathSchema,
  identificationMark: z.string().min(2, "Identification mark is required"),

  // Step 2 — Address Details
  houseName: z.string().min(2, "House name is required"),
  place: z.string().min(2, "Place is required"),
  postOffice: z.string().min(2, "Post office is required"),
  pincode: z.string().length(6, "Pincode must be 6 digits").regex(/^\d{6}$/, "Invalid pincode"),
  district: z.string().min(2, "District is required"),
  state: z.string().min(2, "State is required"),

  // Step 3 — Educational Details
  aadhaarNumber: z
    .string()
    .length(12, "Aadhaar number must be 12 digits")
    .regex(/^\d{12}$/, "Invalid Aadhaar number"),
  schoolName: z.string().min(2, "School name is required"),
  schoolClass: z.string().min(1, "Present class (School) is required"),
  madrasaName: z.string().min(2, "Madrasa name is required"),
  madrasaAffiliationNumber: z.string().min(1, "Madrasa affiliation number is required"),
  madrasaClass: z.string().min(1, "Present class (Madrasa) is required"),

  // Step 4 — Guardian & Contact
  guardianName: z.string().min(2, "Guardian's name is required"),
  guardianRelation: z.string().min(2, "Relation with guardian is required"),
  guardianPhone: z.string().min(10, "Valid phone number required").max(15),
  alternatePhone: z.string().min(10, "Valid alternate phone number required").max(15),

  // Step 5 — Payment
  paymentScreenshotUrl: uploadedFilePathSchema,
});

export const updateApplicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["shortlisted", "selected", "rejected"]),
  rejectionReason: z.string().optional(),
});

export const generateHallTicketSchema = z.object({
  applicationId: z.string().uuid(),
  examDate: z.string().min(1, "Exam date is required"),
  examCenter: z.string().optional(),
  examTime: z.string().optional(),
});

export const admissionFormSchema = z.object({
  applicationId: z.string().uuid().optional(),

  // Personal
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female"]),
  bloodGroup: z.string().optional(),
  nationality: z.string().default("Indian"),
  religion: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  medicalNotes: z.string().optional(),
  emergencyContact: z.string().optional(),
  photoUrl: z.string().optional(),

  // Parent info
  fatherName: z.string().min(2, "Father's name is required"),
  motherName: z.string().optional(),
  primaryPhone: z.string().min(10, "Phone number is required"),
  whatsappNumber: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  occupation: z.string().optional(),

  // Class allocation
  hifzClassId: z.string().uuid("Hifz class is required"),
  madrasaClassId: z.string().uuid("Madrasa class is required"),
  schoolClassId: z.string().uuid("School class is required"),
  yearOfStudy: z.enum(["1st", "2nd", "3rd"]),

  // Academic year
  admissionDate: z.string().min(1, "Admission date is required"),
  admissionYearId: z.string().uuid(),
});

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type GenerateHallTicketInput = z.infer<typeof generateHallTicketSchema>;
export type AdmissionFormInput = z.infer<typeof admissionFormSchema>;
