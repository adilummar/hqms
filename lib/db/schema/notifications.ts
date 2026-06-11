// Phase 3 — Schema only, no Phase 1 UI
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { notificationChannelEnum } from "./enums";
import { users } from "./users";
import { students } from "./students";

export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  subject: varchar("subject", { length: 200 }),
  body: text("body").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").references(() => notificationTemplates.id, {
    onDelete: "set null",
  }),
  recipientUserId: uuid("recipient_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  studentId: uuid("student_id").references(() => students.id, {
    onDelete: "set null",
  }),
  channel: notificationChannelEnum("channel").notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 200 }),
  body: text("body").notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  sentAt: timestamp("sent_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
