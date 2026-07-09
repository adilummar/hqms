-- ============================================================
-- SUPABASE SQL: Session Changes — 2026-07-03
-- ============================================================
-- File: supabase_session_2026-07-03.sql
--
-- HOW TO RUN IN SUPABASE:
--   1. Go to your Supabase project dashboard
--   2. Click "SQL Editor" in the left sidebar
--   3. Click "New query"
--   4. Paste this ENTIRE script and click "Run"
--   5. All statements use IF NOT EXISTS / ON CONFLICT so it is
--      SAFE to run multiple times without side-effects.
--
-- CHANGES COVERED IN THIS FILE:
--   A. No schema changes were needed for:
--      - Hifz filter fix (tutor portal) — frontend only
--      - Sabaq Juz default fix (tutor entry form) — frontend only
--   B. The "Add Juz to Student Edit Profile" feature uses the
--      EXISTING juz_tracker table — no new tables or columns.
--      However, the table must exist and have the correct unique
--      constraint. This script verifies / adds what may be missing
--      if you are running on a freshly created Supabase project
--      that never had migration 0000 applied.
-- ============================================================


-- ============================================================
-- SECTION 1 — Ensure juz_status enum exists
-- (already created in migration 0000; safe to skip if present)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'juz_status'
  ) THEN
    CREATE TYPE "public"."juz_status" AS ENUM (
      'not_started',
      'in_progress',
      'completed'
    );
  END IF;
END $$;


-- ============================================================
-- SECTION 2 — Ensure juz_tracker table exists
-- (already created in migration 0000; safe to skip if present)
-- ============================================================
CREATE TABLE IF NOT EXISTS "juz_tracker" (
  "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"      uuid        NOT NULL
                                REFERENCES "students"("id") ON DELETE CASCADE,
  "juz_number"      integer     NOT NULL,           -- 1 – 30
  "start_date"      date,
  "completion_date" date,
  "status"          "juz_status" NOT NULL DEFAULT 'not_started',
  "notes"           text,
  "updated_by"      uuid        REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"      timestamp   NOT NULL DEFAULT now(),
  "updated_at"      timestamp   NOT NULL DEFAULT now(),
  CONSTRAINT "juz_tracker_student_id_juz_number_unique"
    UNIQUE ("student_id", "juz_number")
);


-- ============================================================
-- SECTION 3 — Useful index for fast per-student lookups
-- (no-op if already exists)
-- ============================================================
CREATE INDEX IF NOT EXISTS "juz_tracker_student_id_idx"
  ON "juz_tracker" ("student_id");

CREATE INDEX IF NOT EXISTS "juz_tracker_status_idx"
  ON "juz_tracker" ("status");


-- ============================================================
-- SECTION 4 — Ensure hifz_daily_entries has the integer[]
--             daura_juz_numbers column (was in migration 0000)
-- ============================================================
ALTER TABLE "hifz_daily_entries"
  ADD COLUMN IF NOT EXISTS "daura_juz_numbers" integer[];


-- ============================================================
-- VERIFICATION QUERIES
-- Uncomment and run after the script to confirm everything is OK
-- ============================================================

-- Check juz_tracker table structure:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'juz_tracker'
-- ORDER BY ordinal_position;

-- Check juz_tracker data for a specific student:
-- SELECT juz_number, status, start_date, completion_date
-- FROM juz_tracker
-- WHERE student_id = '<your-student-uuid>'
-- ORDER BY juz_number;

-- Check hifz_daily_entries has the array column:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'hifz_daily_entries'
--   AND column_name = 'daura_juz_numbers';

-- Count juz rows per student:
-- SELECT
--   s.student_code,
--   s.first_name,
--   COUNT(j.id)                                          AS total_juz_rows,
--   COUNT(*) FILTER (WHERE j.status = 'completed')      AS completed,
--   COUNT(*) FILTER (WHERE j.status = 'in_progress')    AS in_progress,
--   COUNT(*) FILTER (WHERE j.status = 'not_started')    AS not_started
-- FROM students s
-- LEFT JOIN juz_tracker j ON j.student_id = s.id
-- GROUP BY s.id, s.student_code, s.first_name
-- ORDER BY s.first_name;


-- ============================================================
-- ROLLBACK (only if you need to undo juz_tracker creation)
-- WARNING: This will DELETE all juz progress data permanently!
-- ============================================================
-- DROP TABLE IF EXISTS juz_tracker;
-- DROP TYPE  IF EXISTS juz_status;
-- ============================================================
