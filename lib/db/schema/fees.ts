// Phase 2 — Schema only, no Phase 1 UI
import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { feeStatusEnum } from "./enums";
import { academicYears } from "./settings";
import { students } from "./students";

export const feeCategories = pgTable("fee_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  isRecurring: varchar("is_recurring", { length: 5 }).default("false"),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feePayments = pgTable("fee_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  feeCategoryId: uuid("fee_category_id")
    .notNull()
    .references(() => feeCategories.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: feeStatusEnum("status").default("pending"),
  paidAt: timestamp("paid_at"),
  receiptNumber: varchar("receipt_number", { length: 30 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
