import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { examStatusEnum, examTrackEnum, resultStatusEnum } from "./enums";
import { classes } from "./classes";
import { academicYears } from "./settings";
import { students } from "./students";
import { users } from "./users";

// ─── Exam Sessions ───────────────────────────────────────────────────────────
// One exam session = one exam period (e.g. "First Term 2025 — Madrasa")
export const examSessions = pgTable("exam_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),       // "First Term 2025"
  track: examTrackEnum("track").notNull(),                 // school | madrasa | hifz
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "restrict" }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: examStatusEnum("status").default("scheduled").notNull(),
  resultStatus: resultStatusEnum("result_status").default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Exam Subjects ────────────────────────────────────────────────────────────
// Subjects per (session, class). Different classes can have different subjects.
export const examSubjects = pgTable("exam_subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  examSessionId: uuid("exam_session_id")
    .notNull()
    .references(() => examSessions.id, { onDelete: "cascade" }),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 150 }).notNull(),       // "English", "Quran", "Thareek"
  totalMarks: integer("total_marks").notNull().default(100),
  passMarks: integer("pass_marks").notNull().default(35),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Exam Grade Rules ─────────────────────────────────────────────────────────
// Grade thresholds per exam session (applies to all subjects in that session).
// e.g. A+: ≥90%, A: ≥75%, B: ≥60%, C: ≥45%, F: <pass mark
export const examGradeRules = pgTable("exam_grade_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  examSessionId: uuid("exam_session_id")
    .notNull()
    .references(() => examSessions.id, { onDelete: "cascade" }),
  grade: varchar("grade", { length: 10 }).notNull(),       // "A+", "A", "B", "C", "F"
  minPercentage: numeric("min_percentage", { precision: 5, scale: 2 }).notNull(),
  label: varchar("label", { length: 50 }),                 // "Excellent", "Pass", "Fail"
  isFailing: boolean("is_failing").default(false).notNull(), // marks this grade as failing
  displayOrder: integer("display_order").default(0),
});

// ─── Exam Marks ───────────────────────────────────────────────────────────────
// Individual student mark per subject
export const examMarks = pgTable(
  "exam_marks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examSubjectId: uuid("exam_subject_id")
      .notNull()
      .references(() => examSubjects.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    marksObtained: numeric("marks_obtained", { precision: 6, scale: 2 }),
    isAbsent: boolean("is_absent").default(false).notNull(),
    remarks: varchar("remarks", { length: 200 }),
    enteredBy: uuid("entered_by")
      .references(() => users.id, { onDelete: "set null" }),
    enteredAt: timestamp("entered_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({ uniq: unique().on(t.examSubjectId, t.studentId) })
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const examSessionsRelations = relations(examSessions, ({ one, many }) => ({
  academicYear: one(academicYears, {
    fields: [examSessions.academicYearId],
    references: [academicYears.id],
  }),
  createdByUser: one(users, {
    fields: [examSessions.createdBy],
    references: [users.id],
  }),
  subjects: many(examSubjects),
  gradeRules: many(examGradeRules),
}));

export const examSubjectsRelations = relations(examSubjects, ({ one, many }) => ({
  examSession: one(examSessions, {
    fields: [examSubjects.examSessionId],
    references: [examSessions.id],
  }),
  class: one(classes, {
    fields: [examSubjects.classId],
    references: [classes.id],
  }),
  marks: many(examMarks),
}));

export const examGradeRulesRelations = relations(examGradeRules, ({ one }) => ({
  examSession: one(examSessions, {
    fields: [examGradeRules.examSessionId],
    references: [examSessions.id],
  }),
}));

export const examMarksRelations = relations(examMarks, ({ one }) => ({
  subject: one(examSubjects, {
    fields: [examMarks.examSubjectId],
    references: [examSubjects.id],
  }),
  student: one(students, {
    fields: [examMarks.studentId],
    references: [students.id],
  }),
  enteredByUser: one(users, {
    fields: [examMarks.enteredBy],
    references: [users.id],
  }),
}));
