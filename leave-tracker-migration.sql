-- Leave Tracker Migration
-- Run this in your PostgreSQL database to add the 5 Leave Tracker tables.
-- Safe to run multiple times (uses IF NOT EXISTS).

-- 1. Leave Periods
CREATE TABLE IF NOT EXISTS "leave_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Leave Period Days
CREATE TABLE IF NOT EXISTS "leave_period_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_period_id" uuid NOT NULL REFERENCES "leave_periods"("id") ON DELETE CASCADE,
  "day_number" integer NOT NULL,
  "date" date NOT NULL,
  "label" varchar(50),
  CONSTRAINT "leave_period_days_leave_period_id_day_number_unique" UNIQUE ("leave_period_id", "day_number")
);

-- 3. Leave Activities
CREATE TABLE IF NOT EXISTS "leave_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" varchar(200),
  "icon" varchar(50),
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_suspended_on_holiday" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 4. Leave Day Activity Suspensions (per-day, per-activity suspension)
CREATE TABLE IF NOT EXISTS "leave_day_activity_suspensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_period_day_id" uuid NOT NULL REFERENCES "leave_period_days"("id") ON DELETE CASCADE,
  "activity_id" uuid NOT NULL REFERENCES "leave_activities"("id") ON DELETE CASCADE,
  CONSTRAINT "leave_day_activity_suspensions_leave_period_day_id_activity_id_unique" UNIQUE ("leave_period_day_id", "activity_id")
);

-- 5. Leave Activity Responses (parent-submitted per student/day/activity)
CREATE TABLE IF NOT EXISTS "leave_activity_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_period_id" uuid NOT NULL REFERENCES "leave_periods"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "day_number" integer NOT NULL,
  "activity_id" uuid NOT NULL REFERENCES "leave_activities"("id") ON DELETE CASCADE,
  "completed" boolean DEFAULT false NOT NULL,
  "recorded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "recorded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "leave_activity_responses_leave_period_id_student_id_day_number_activity_id_unique"
    UNIQUE ("leave_period_id", "student_id", "day_number", "activity_id")
);

-- 6. Seed default 10 activities (safe to run multiple times)
INSERT INTO "leave_activities" ("name", "description", "display_order", "is_suspended_on_holiday", "is_active")
VALUES
  ('Tahajjud',        'Pre-Fajr prayer',          0, false, true),
  ('Subh Jama''ah',   'Fajr congregation',         1, false, true),
  ('Sabaq Juz',       'Morning lesson revision',   2, true,  true),
  ('Zuha Namaz',      'Mid-morning prayer',        3, false, true),
  ('Zuhr Jama''ah',   'Midday congregation',       4, false, true),
  ('Daura',           'Afternoon revision',        5, true,  true),
  ('Asr Jama''ah',    'Afternoon congregation',    6, false, true),
  ('Play',            'Recreation time',           7, false, true),
  ('Maghrib Jama''ah','Sunset congregation',       8, false, true),
  ('Isha Jama''ah',   'Night congregation',        9, false, true)
ON CONFLICT DO NOTHING;
