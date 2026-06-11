import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { applicationStatusEnum, classTrackEnum } from "./enums";
import { users } from "./users";
import { academicYears } from "./settings";
import { relations } from "drizzle-orm";

export const admissionApplications = pgTable("admission_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationNumber: varchar("application_number", { length: 20 })
    .unique()
    .notNull(), // APP-2024-0001

  // Applicant details
  applicantName: varchar("applicant_name", { length: 150 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  identificationMark: varchar("identification_mark", { length: 200 }).notNull(),

  // Parent/Guardian details
  fatherName: varchar("father_name", { length: 150 }).notNull(),
  fatherOccupation: varchar("father_occupation", { length: 150 }).notNull(),
  motherName: varchar("mother_name", { length: 150 }),
  guardianName: varchar("guardian_name", { length: 150 }),
  guardianRelation: varchar("guardian_relation", { length: 100 }),
  guardianPhone: varchar("guardian_phone", { length: 20 }).notNull(),
  alternatePhone: varchar("alternate_phone", { length: 20 }),
  guardianEmail: varchar("guardian_email", { length: 255 }),

  // Address (individual fields)
  houseName: varchar("house_name", { length: 200 }),
  place: varchar("place", { length: 200 }),
  postOffice: varchar("post_office", { length: 200 }),
  pincode: varchar("pincode", { length: 10 }),
  district: varchar("district", { length: 150 }),
  state: varchar("state", { length: 150 }),
  // Legacy combined address field (kept for backward compat)
  address: text("address"),

  // Aadhaar
  aadhaarNumber: varchar("aadhaar_number", { length: 12 }),

  // School details
  schoolName: varchar("school_name", { length: 250 }),
  schoolClass: varchar("school_class", { length: 50 }),

  // Madrasa details
  madrasaName: varchar("madrasa_name", { length: 250 }),
  madrasaAffiliationNumber: varchar("madrasa_affiliation_number", { length: 100 }),
  madrasaClass: varchar("madrasa_class", { length: 50 }),

  // Tracks applying for
  appliedTracks: classTrackEnum("applied_tracks").array().notNull(),

  // Documents (Cloudinary URLs or Local Paths)
  photoUrl: text("photo_url").notNull(),
  paymentScreenshotUrl: text("payment_screenshot_url").notNull(),
  documentUrls: jsonb("document_urls").$type<string[]>().default([]),

  // Status
  status: applicationStatusEnum("status").default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at"),

  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "restrict" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hallTickets = pgTable("hall_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => admissionApplications.id, { onDelete: "cascade" }),
  hallTicketNumber: varchar("hall_ticket_number", { length: 20 })
    .unique()
    .notNull(), // HT-2024-0001
  examDate: date("exam_date").notNull(),
  examCenter: varchar("exam_center", { length: 200 }),
  examTime: varchar("exam_time", { length: 20 }),
  isGenerated: boolean("is_generated").default(false).notNull(),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const admissionApplicationsRelations = relations(
  admissionApplications,
  ({ one }) => ({
    hallTicket: one(hallTickets, {
      fields: [admissionApplications.id],
      references: [hallTickets.applicationId],
    }),
    reviewedByUser: one(users, {
      fields: [admissionApplications.reviewedBy],
      references: [users.id],
    }),
    academicYear: one(academicYears, {
      fields: [admissionApplications.academicYearId],
      references: [academicYears.id],
    }),
  })
);

export const hallTicketsRelations = relations(hallTickets, ({ one }) => ({
  application: one(admissionApplications, {
    fields: [hallTickets.applicationId],
    references: [admissionApplications.id],
  }),
}));
