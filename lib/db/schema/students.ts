import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { studentStatusEnum, enrollmentStatusEnum, starTypeEnum } from "./enums";
import { users } from "./users";
import { admissionApplications } from "./admissions";
import { academicYears } from "./settings";
import { classes } from "./classes";
import { relations } from "drizzle-orm";

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentCode: varchar("student_code", { length: 20 }).unique().notNull(), // HQMS-2024-0001
  userId: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  applicationId: uuid("application_id").references(
    () => admissionApplications.id,
    { onDelete: "set null" }
  ),

  // Personal
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  bloodGroup: varchar("blood_group", { length: 5 }),
  nationality: varchar("nationality", { length: 50 }).default("Indian"),
  religion: varchar("religion", { length: 50 }),
  address: text("address"),
  photoUrl: text("photo_url"),
  documentUrls: jsonb("document_urls").$type<string[]>().default([]),
  medicalNotes: text("medical_notes"),
  emergencyContact: varchar("emergency_contact", { length: 20 }),

  // Status
  status: studentStatusEnum("status").default("active").notNull(),
  admissionDate: date("admission_date").notNull(),
  completionDate: date("completion_date"),
  discontinuationDate: date("discontinuation_date"),
  discontinuationReason: text("discontinuation_reason"),

  admissionYearId: uuid("admission_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "restrict" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parents = pgTable("parents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .unique()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  fatherName: varchar("father_name", { length: 150 }),
  motherName: varchar("mother_name", { length: 150 }),
  primaryPhone: varchar("primary_phone", { length: 20 }).notNull(),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }),
  email: varchar("email", { length: 255 }),
  occupation: varchar("occupation", { length: 100 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    yearOfStudy: varchar("year_of_study", { length: 10 }), // "1st", "2nd", "3rd"
    status: enrollmentStatusEnum("status").default("active").notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    uniq: unique().on(table.studentId, table.classId, table.academicYearId),
  })
);

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, { fields: [students.userId], references: [users.id] }),
  application: one(admissionApplications, {
    fields: [students.applicationId],
    references: [admissionApplications.id],
  }),
  admissionYear: one(academicYears, {
    fields: [students.admissionYearId],
    references: [academicYears.id],
  }),
  parent: one(parents, { fields: [students.id], references: [parents.studentId] }),
  enrollments: many(enrollments),
}));

export const parentsRelations = relations(parents, ({ one }) => ({
  user: one(users, { fields: [parents.userId], references: [users.id] }),
  student: one(students, {
    fields: [parents.studentId],
    references: [students.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
  academicYear: one(academicYears, {
    fields: [enrollments.academicYearId],
    references: [academicYears.id],
  }),
}));

// ── Student Stars (Blue / Black) ───────────────────────────────────────────────────
// Blue = positive behaviour/performance  |  Black = negative/warning

export const studentStars = pgTable("student_stars", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  type: starTypeEnum("type").notNull(),
  reason: text("reason").notNull(),
  awardedBy: uuid("awarded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentStarsRelations = relations(studentStars, ({ one }) => ({
  student: one(students, {
    fields: [studentStars.studentId],
    references: [students.id],
  }),
  awardedByUser: one(users, {
    fields: [studentStars.awardedBy],
    references: [users.id],
  }),
}));

