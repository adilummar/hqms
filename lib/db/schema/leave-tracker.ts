import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { students } from "./students";
import { users } from "./users";
import { relations } from "drizzle-orm";

// ── Leave Periods ─────────────────────────────────────────────────────────────
// A leave period is a named holiday window (e.g. "July Leave 2026").
// Only one can be active at a time.
export const leavePeriods = pgTable("leave_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "July Leave 2026"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Leave Period Days ─────────────────────────────────────────────────────────
// One row per calendar day within a leave period.
// Days are auto-generated from startDate → endDate when a period is created.
export const leavePeriodDays = pgTable(
  "leave_period_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leavePeriodId: uuid("leave_period_id")
      .notNull()
      .references(() => leavePeriods.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(), // 1, 2, 3 …
    date: date("date").notNull(),
    label: varchar("label", { length: 50 }), // optional, e.g. "Eid Day"
  },
  (table) => ({
    uniq: unique().on(table.leavePeriodId, table.dayNumber),
  })
);

// ── Leave Activities ──────────────────────────────────────────────────────────
// The configurable list of daily activities to track.
// Admin can add / rename / reorder / disable activities.
export const leaveActivities = pgTable("leave_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "Tahajjud"
  description: varchar("description", { length: 200 }), // "Pre-Fajr prayer"
  icon: varchar("icon", { length: 50 }), // lucide icon name, e.g. "Moon"
  displayOrder: integer("display_order").default(0).notNull(),
  isSuspendedOnHoliday: boolean("is_suspended_on_holiday").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Leave Day Activity Suspensions ────────────────────────────────────────────
// Granular per-day, per-activity suspension.
// A row here means: this activity is SUSPENDED on this specific day.
// Example: remove "Subh Jama'ah" from Thursday only.
export const leaveDayActivitySuspensions = pgTable(
  "leave_day_activity_suspensions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leavePeriodDayId: uuid("leave_period_day_id")
      .notNull()
      .references(() => leavePeriodDays.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => leaveActivities.id, { onDelete: "cascade" }),
  },
  (table) => ({
    uniq: unique().on(table.leavePeriodDayId, table.activityId),
  })
);

// ── Leave Activity Responses ──────────────────────────────────────────────────
// Parent-submitted completion record per student, per day, per activity.
export const leaveActivityResponses = pgTable(
  "leave_activity_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leavePeriodId: uuid("leave_period_id")
      .notNull()
      .references(() => leavePeriods.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => leaveActivities.id, { onDelete: "cascade" }),
    completed: boolean("completed").default(false).notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(
      table.leavePeriodId,
      table.studentId,
      table.dayNumber,
      table.activityId
    ),
  })
);

// ── Relations ─────────────────────────────────────────────────────────────────
export const leavePeriodsRelations = relations(leavePeriods, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [leavePeriods.createdBy],
    references: [users.id],
  }),
  days: many(leavePeriodDays),
  responses: many(leaveActivityResponses),
}));

export const leavePeriodDaysRelations = relations(leavePeriodDays, ({ one, many }) => ({
  leavePeriod: one(leavePeriods, {
    fields: [leavePeriodDays.leavePeriodId],
    references: [leavePeriods.id],
  }),
  suspensions: many(leaveDayActivitySuspensions),
}));

export const leaveActivitiesRelations = relations(leaveActivities, ({ many }) => ({
  suspensions: many(leaveDayActivitySuspensions),
  responses: many(leaveActivityResponses),
}));

export const leaveDayActivitySuspensionsRelations = relations(
  leaveDayActivitySuspensions,
  ({ one }) => ({
    day: one(leavePeriodDays, {
      fields: [leaveDayActivitySuspensions.leavePeriodDayId],
      references: [leavePeriodDays.id],
    }),
    activity: one(leaveActivities, {
      fields: [leaveDayActivitySuspensions.activityId],
      references: [leaveActivities.id],
    }),
  })
);

export const leaveActivityResponsesRelations = relations(
  leaveActivityResponses,
  ({ one }) => ({
    leavePeriod: one(leavePeriods, {
      fields: [leaveActivityResponses.leavePeriodId],
      references: [leavePeriods.id],
    }),
    student: one(students, {
      fields: [leaveActivityResponses.studentId],
      references: [students.id],
    }),
    activity: one(leaveActivities, {
      fields: [leaveActivityResponses.activityId],
      references: [leaveActivities.id],
    }),
    recordedByUser: one(users, {
      fields: [leaveActivityResponses.recordedBy],
      references: [users.id],
    }),
  })
);
