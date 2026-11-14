import {
  pgTable,
  uuid,
  date,
  text,
  varchar,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { attendanceStatusEnum, leaveTypeEnum, classTrackEnum, attendanceSessionEnum, parentMeetingStatusEnum } from "./enums";
import { students } from "./students";
import { classes } from "./classes";
import { users } from "./users";
import { remarksOptions } from "./remarks";
import { relations, sql } from "drizzle-orm";

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
    session: attendanceSessionEnum("session"),
    status: attendanceStatusEnum("status").notNull(),
    leaveType: leaveTypeEnum("leave_type"),
    absenceReasonId: uuid("absence_reason_id").references(() => remarksOptions.id, { onDelete: "restrict" }),
    remarks: text("remarks"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    uniq: unique().on(table.studentId, table.classId, table.date, table.session),
  })
);

// Staff attendance.
// Legacy rows (before the FN/AN rollout) have session = NULL: one row per
// user per day. New rows carry session FN | AN: one row per user/date/session.
export const staffAttendance = pgTable(
  "staff_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    session: attendanceSessionEnum("session"), // NULL = legacy single-session record
    status: attendanceStatusEnum("status").notNull(),
    leaveType: leaveTypeEnum("leave_type"),
    remarks: text("remarks"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // ── FN/AN additions ──
    checkInAt: timestamp("check_in_at", { withTimezone: true }), // real check-in moment (self check-in)
    source: varchar("source", { length: 10 }), // 'self' | 'auto' | 'admin' (NULL = legacy)
    originalStatus: attendanceStatusEnum("original_status"), // set on first admin correction
    originalSource: varchar("original_source", { length: 10 }), // e.g. 'auto' when an automatic absence was corrected
    correctedBy: uuid("corrected_by").references(() => users.id, { onDelete: "set null" }),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.userId, table.date, table.session),
    legacyUniq: uniqueIndex("staff_attendance_legacy_user_date_uniq")
      .on(table.userId, table.date)
      .where(sql`${table.session} IS NULL`),
  })
);

// Admin-managed non-working days for staff attendance (holidays, students'
// leave periods, other closures). One row per date + scope; ranges are expanded.
// Weekly off days live in settings.staff_weekly_off_days.
export const staffOffDays = pgTable(
  "staff_off_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    scope: varchar("scope", { length: 4 }).default("both").notNull(), // 'both' | 'FN' | 'AN'
    type: varchar("type", { length: 20 }).default("holiday").notNull(), // 'holiday' | 'students_leave' | 'other'
    reason: varchar("reason", { length: 150 }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.date, table.scope),
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

export const staffAttendanceRelations = relations(staffAttendance, ({ one }) => ({
  user: one(users, {
    fields: [staffAttendance.userId],
    references: [users.id],
  }),
  recordedByUser: one(users, {
    fields: [staffAttendance.recordedBy],
    references: [users.id],
  }),
  correctedByUser: one(users, {
    fields: [staffAttendance.correctedBy],
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
    attended: boolean("attended"),
    status: parentMeetingStatusEnum("status"),
    remarks: text("remarks"),
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

// ── Staff Meetings ───────────────────────────────────────────────────────────
// Institutional staff/faculty meetings created by Admin.
// Includes agenda, discussion minutes, and decisions/resolutions ("disitions").

export const staffMeetings = pgTable("staff_meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 150 }).notNull(),
  meetingDate: date("meeting_date").notNull(),
  meetingTime: varchar("meeting_time", { length: 50 }),
  location: varchar("location", { length: 150 }),
  description: text("description"), // Agenda / Discussion topics
  status: varchar("status", { length: 50 }).default("scheduled").notNull(), // scheduled, completed, cancelled
  minutes: text("minutes"), // Discussion minutes
  decisions: text("decisions"), // Decisions taken / Action items
  // school | madrasa | management | custom. NULL = legacy meeting (uncategorised).
  category: varchar("category", { length: 20 }),
  customCategory: varchar("custom_category", { length: 100 }), // only when category = custom
  // false = legacy meeting: roster is the live eligible-staff list.
  // true  = participants chosen for this meeting (staffMeetingAttendance rows + external guests).
  participantsExplicit: boolean("participants_explicit").default(false).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const staffMeetingAttendance = pgTable(
  "staff_meeting_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => staffMeetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attended: boolean("attended").default(true).notNull(),
    remarks: text("remarks"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniq: unique().on(table.meetingId, table.userId),
  })
);

// External guests (not HQMS users). Belong to exactly one meeting; attendance is stored inline.
export const staffMeetingExternalParticipants = pgTable(
  "staff_meeting_external_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => staffMeetings.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    designation: varchar("designation", { length: 120 }),
    contactNumber: varchar("contact_number", { length: 40 }),
    attended: boolean("attended").default(true).notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    meetingIdx: index("staff_meeting_ext_meeting_idx").on(table.meetingId),
  })
);

export const staffMeetingExternalParticipantsRelations = relations(
  staffMeetingExternalParticipants,
  ({ one }) => ({
    meeting: one(staffMeetings, {
      fields: [staffMeetingExternalParticipants.meetingId],
      references: [staffMeetings.id],
    }),
  })
);

export const staffMeetingsRelations = relations(
  staffMeetings,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [staffMeetings.createdBy],
      references: [users.id],
    }),
    attendanceRecords: many(staffMeetingAttendance),
    externalParticipants: many(staffMeetingExternalParticipants),
  })
);

export const staffMeetingAttendanceRelations = relations(
  staffMeetingAttendance,
  ({ one }) => ({
    meeting: one(staffMeetings, {
      fields: [staffMeetingAttendance.meetingId],
      references: [staffMeetings.id],
    }),
    user: one(users, {
      fields: [staffMeetingAttendance.userId],
      references: [users.id],
    }),
    recordedByUser: one(users, {
      fields: [staffMeetingAttendance.recordedBy],
      references: [users.id],
    }),
  })
);
