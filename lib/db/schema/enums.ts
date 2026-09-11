import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "tutor",
  "school_admin",
  "parent",
  "student",
  "madrasa_admin",
]);

export const studentStatusEnum = pgEnum("student_status", [
  "active",
  "completed",
  "discontinued",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "shortlisted",
  "selected",
  "rejected",
]);

export const classTrackEnum = pgEnum("class_track", [
  "hifz",
  "madrasa",
  "school",
]);

export const attendanceSessionEnum = pgEnum("attendance_session", ["FN", "AN"]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "leave",
]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "sick_leave",
  "casual_leave",
  "approved_leave",
]);

export const juzStatusEnum = pgEnum("juz_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "completed",
  "withdrawn",
]);

export const remarksCategory = pgEnum("remarks_category", [
  "sabaq",
  "sabaq_juz",
  "daura",
  "attendance",
]);

export const parentMeetingStatusEnum = pgEnum("parent_meeting_status", [
  "ON_TIME",
  "LATE",
  "ABSENT_WITH_REASON",
  "ABSENT_WITHOUT_VALID_REASON",
]);

export const targetPeriodEnum = pgEnum("target_period", ["monthly", "yearly"]);

export const feeStatusEnum = pgEnum("fee_status", [
  "pending",
  "paid",
  "partial",
  "overdue",
]);

export const examStatusEnum = pgEnum("exam_status", [
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
]);

export const examTrackEnum = pgEnum("exam_track", [
  "school",
  "madrasa",
  "hifz",
]);

export const resultStatusEnum = pgEnum("result_status", [
  "draft",
  "published",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "sms",
  "whatsapp",
  "email",
  "in_app",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "exam_results_published",
  "parent_meeting_announced",
  "parent_meeting_reminder",
  "parent_meeting_attendance_recorded",
  "hifz_entry_created",
  "juz_completed",
  "hafiz_milestone",
  "leave_period_activated",
]);

export const starTypeEnum = pgEnum("star_type", ["blue", "black"]);
