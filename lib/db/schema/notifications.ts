import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { notificationChannelEnum, notificationTypeEnum } from "./enums";
import { users } from "./users";
import { students } from "./students";
import { relations } from "drizzle-orm";

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

// New In-App Notifications Inbox
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    deepLink: varchar("deep_link", { length: 500 }),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique().notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipientUser: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));
