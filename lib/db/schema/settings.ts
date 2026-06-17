import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
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
  label: varchar("label", { length: 20 }).unique().notNull(), // kept for compat — mirrors batchNumber
  batchNumber: integer("batch_number").unique(), // 1, 2, 3 — the primary display identifier
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Placeholder relations — enrollments and classes import academicYears so
// we define a minimal self-referencing relation to allow `with` queries.
export const academicYearsRelations = relations(academicYears, () => ({}));

// ── Batches ───────────────────────────────────────────────────────────────────
// A batch is a student cohort (Batch 1, Batch 2 …).
// Separate from academic years (time periods). Assigned to each student at
// admission and never changes.
export const batches = pgTable("batches", {
  id:          uuid("id").defaultRandom().primaryKey(),
  batchNumber: integer("batch_number").unique().notNull(), // 1, 2, 3…
  label:       varchar("label", { length: 30 }).notNull(), // "Batch 1"
  notes:       text("notes"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// Relations — the students→batch relation is declared on the students side
// to avoid circular imports. This empty object is required by Drizzle.
export const batchesRelations = relations(batches, () => ({}));
