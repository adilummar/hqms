import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { remarksCategory } from "./enums";

export const remarksOptions = pgTable("remarks_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: remarksCategory("category").notNull(),
  label: varchar("label", { length: 150 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Seed data:
// sabaq: "Holiday", "Student Sick", "Usthad Absent", "Exam Day", "Travel", "Other"
// sabaq_juz: "Not Ready", "Time Shortage", "Holiday", "Student Sick", "Other"
// daura: "Not Assigned Yet", "Holiday", "Exam", "Other"
// attendance: "Sick Leave", "Family Emergency", "Travel", "Other"
