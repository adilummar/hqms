import {
  pgTable,
  uuid,
  date,
  integer,
  numeric,
  boolean,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { juzStatusEnum } from "./enums";
import { students } from "./students";
import { users } from "./users";
import { remarksOptions } from "./remarks";
import { relations } from "drizzle-orm";

// 30-juz tracker per student
export const juzTracker = pgTable(
  "juz_tracker",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    juzNumber: integer("juz_number").notNull(), // 1–30
    startDate: date("start_date"),
    completionDate: date("completion_date"),
    status: juzStatusEnum("status").default("not_started").notNull(),
    notes: text("notes"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.studentId, table.juzNumber),
  })
);

// Daily Hifz progress entry
export const hifzDailyEntries = pgTable(
  "hifz_daily_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    date: date("date").notNull(),

    // Sabaq (new lesson)
    sabaqFromPage: numeric("sabaq_from_page", { precision: 5, scale: 1 }),
    sabaqToPage: numeric("sabaq_to_page", { precision: 5, scale: 1 }),
    sabaqPages: numeric("sabaq_pages", { precision: 5, scale: 1 }),
    sabaqJuzNumber: integer("sabaq_juz_number"),
    sabaqRemarksId: uuid("sabaq_remarks_id").references(
      () => remarksOptions.id,
      { onDelete: "set null" }
    ),

    // Sabaq Juz (revision)
    sabaqJuzGiven: boolean("sabaq_juz_given"),
    sabaqJuzRemarksId: uuid("sabaq_juz_remarks_id").references(
      () => remarksOptions.id,
      { onDelete: "set null" }
    ),

    // Daura (long revision) — session 1
    dauraJuzNumbers: integer("daura_juz_numbers").array(),
    dauraRemarksId: uuid("daura_remarks_id").references(
      () => remarksOptions.id,
      { onDelete: "set null" }
    ),

    // Daura session 2 — used in Hafiz mode (two daura sittings per day)
    daura2JuzNumbers: integer("daura2_juz_numbers").array(),
    daura2RemarksId: uuid("daura2_remarks_id").references(
      () => remarksOptions.id,
      { onDelete: "set null" }
    ),

    // Meta
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.studentId, table.date),
  })
);

// Monthly targets per student per month
export const monthlyTargets = pgTable(
  "monthly_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1–12
    targetJuz: numeric("target_juz", { precision: 4, scale: 1 }).notNull(),
    setBy: uuid("set_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.studentId, table.year, table.month),
  })
);

export const juzTrackerRelations = relations(juzTracker, ({ one }) => ({
  student: one(students, {
    fields: [juzTracker.studentId],
    references: [students.id],
  }),
  updatedByUser: one(users, {
    fields: [juzTracker.updatedBy],
    references: [users.id],
  }),
}));

export const hifzDailyEntriesRelations = relations(
  hifzDailyEntries,
  ({ one }) => ({
    student: one(students, {
      fields: [hifzDailyEntries.studentId],
      references: [students.id],
    }),
    recordedByUser: one(users, {
      fields: [hifzDailyEntries.recordedBy],
      references: [users.id],
    }),
    sabaqRemarks: one(remarksOptions, {
      fields: [hifzDailyEntries.sabaqRemarksId],
      references: [remarksOptions.id],
    }),
    sabaqJuzRemarks: one(remarksOptions, {
      fields: [hifzDailyEntries.sabaqJuzRemarksId],
      references: [remarksOptions.id],
    }),
    dauraRemarks: one(remarksOptions, {
      fields: [hifzDailyEntries.dauraRemarksId],
      references: [remarksOptions.id],
    }),
    daura2Remarks: one(remarksOptions, {
      fields: [hifzDailyEntries.daura2RemarksId],
      references: [remarksOptions.id],
    }),
  })
);

export const monthlyTargetsRelations = relations(monthlyTargets, ({ one }) => ({
  student: one(students, {
    fields: [monthlyTargets.studentId],
    references: [students.id],
  }),
  setByUser: one(users, {
    fields: [monthlyTargets.setBy],
    references: [users.id],
  }),
}));
