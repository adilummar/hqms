import {
  pgTable,
  uuid,
  date,
  text,
  varchar,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { attendanceStatusEnum, leaveTypeEnum, classTrackEnum } from "./enums";
import { students } from "./students";
import { classes } from "./classes";
import { users } from "./users";
import { relations } from "drizzle-orm";

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    track: classTrackEnum("track").notNull(),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    leaveType: leaveTypeEnum("leave_type"),
    remarks: text("remarks"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.studentId, table.classId, table.date),
  })
);

// Staff attendance — Phase 2 ready (schema only)
export const staffAttendance = pgTable(
  "staff_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    leaveType: leaveTypeEnum("leave_type"),
    remarks: text("remarks"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.userId, table.date),
  })
);

export const attendanceRelations = relations(attendanceRecords, ({ one }) => ({
  student: one(students, {
    fields: [attendanceRecords.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [attendanceRecords.classId],
    references: [classes.id],
  }),
  recordedByUser: one(users, {
    fields: [attendanceRecords.recordedBy],
    references: [users.id],
  }),
}));

// ── Parent Meetings ───────────────────────────────────────────────────────────
// Whole-school meetings created by super_admin.
// Tutors mark per-student attendance (attended boolean + optional remarks).

export const parentMeetings = pgTable("parent_meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 150 }).notNull(),
  meetingDate: date("meeting_date").notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parentMeetingAttendance = pgTable(
  "parent_meeting_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => parentMeetings.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    attended: boolean("attended").notNull(),
    remarks: text("remarks"), // only meaningful when attended = false
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.meetingId, table.studentId),
  })
);

export const parentMeetingsRelations = relations(
  parentMeetings,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [parentMeetings.createdBy],
      references: [users.id],
    }),
    attendanceRecords: many(parentMeetingAttendance),
  })
);

export const parentMeetingAttendanceRelations = relations(
  parentMeetingAttendance,
  ({ one }) => ({
    meeting: one(parentMeetings, {
      fields: [parentMeetingAttendance.meetingId],
      references: [parentMeetings.id],
    }),
    student: one(students, {
      fields: [parentMeetingAttendance.studentId],
      references: [students.id],
    }),
    recordedByUser: one(users, {
      fields: [parentMeetingAttendance.recordedBy],
      references: [users.id],
    }),
  })
);
