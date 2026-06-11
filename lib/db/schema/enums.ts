import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "tutor",
  "school_admin",
  "parent",
  "student",
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

export const targetPeriodEnum = pgEnum("target_period", ["monthly", "yearly"]);

// Future enums (Phase 2+)
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

export const starTypeEnum = pgEnum("star_type", ["blue", "black"]);
