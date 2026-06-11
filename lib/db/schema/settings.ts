import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).unique().notNull(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Keys:
// "student_login_enabled" → "true" | "false"
// "current_academic_year" → "2024-25"
// "hifz_year1_monthly_target" → "1"
// "hifz_year2_monthly_target" → "2"
// "hifz_year3_monthly_target" → "2.5"
// "low_attendance_threshold" → "75"

export const academicYears = pgTable("academic_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: varchar("label", { length: 20 }).unique().notNull(), // "2024-25"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Placeholder relations — enrollments and classes import academicYears so
// we define a minimal self-referencing relation to allow `with` queries.
export const academicYearsRelations = relations(academicYears, () => ({}));

