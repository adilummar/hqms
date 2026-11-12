-- Student attendance: Friday and Holiday off-day statuses (per session).
-- Additive and idempotent: only adds two values to the attendance_status enum. No rows are touched.
-- Run this BEFORE tutors use the new "All Friday / All Holiday" buttons.
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'friday';--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'holiday';
