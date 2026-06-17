-- ============================================================
-- SUPABASE SQL MIGRATION: Separate Batches from Academic Years
-- ============================================================
-- File: supabase_0006_separate_batches.sql
--
-- HOW TO RUN IN SUPABASE:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Paste this ENTIRE script and click "Run"
-- 5. If all commands say "Success" — you're done!
--
-- This script is SAFE to run multiple times (uses IF NOT EXISTS
-- and ON CONFLICT DO NOTHING throughout).
-- ============================================================

-- STEP 1: Create the `batches` table
-- A batch is a permanent student cohort (Batch 1, Batch 2, …)
-- Separate from academic_years which are just time periods.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "batches" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_number" integer UNIQUE NOT NULL,
  "label"        varchar(30) NOT NULL,
  "notes"        text,
  "created_at"   timestamp NOT NULL DEFAULT now()
);

-- STEP 2: Seed batches from existing academic_years data
-- If you previously had batch_number on academic_years, this
-- creates matching Batch rows automatically.
-- ──────────────────────────────────────────────────────────
INSERT INTO "batches" ("batch_number", "label", "created_at")
SELECT
  ay.batch_number,
  'Batch ' || ay.batch_number,
  ay.created_at
FROM "academic_years" ay
WHERE ay.batch_number IS NOT NULL
ON CONFLICT (batch_number) DO NOTHING;

-- STEP 3: Add batch_id column to students table
-- Nullable so existing student rows are not broken.
-- ──────────────────────────────────────────────────────────
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "batch_id" uuid
  REFERENCES "batches"("id") ON DELETE SET NULL;

-- STEP 4: Back-fill batch_id for existing students
-- Logic: student → academic_years (via admission_year_id)
--        → batches (via batch_number match)
-- ──────────────────────────────────────────────────────────
UPDATE "students" s
SET    "batch_id" = b.id
FROM   "academic_years" ay
JOIN   "batches" b ON b.batch_number = ay.batch_number
WHERE  s.admission_year_id = ay.id
  AND  ay.batch_number IS NOT NULL
  AND  s.batch_id IS NULL;

-- STEP 5: Add index for fast batch-filtered student queries
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "students_batch_id_idx"
  ON "students"("batch_id");

-- ============================================================
-- VERIFICATION QUERIES
-- Run these after the migration to confirm everything is correct
-- ============================================================

-- Check batches table was populated
-- SELECT * FROM batches ORDER BY batch_number;

-- Check how many students have batch_id assigned
-- SELECT
--   COUNT(*) FILTER (WHERE batch_id IS NOT NULL) AS students_with_batch,
--   COUNT(*) FILTER (WHERE batch_id IS NULL)     AS students_without_batch,
--   COUNT(*)                                     AS total_students
-- FROM students;

-- Check "current" batches (those with active students)
-- SELECT b.label, COUNT(s.id) AS active_students
-- FROM batches b
-- LEFT JOIN students s ON s.batch_id = b.id AND s.status = 'active'
-- GROUP BY b.id, b.label
-- ORDER BY b.batch_number;

-- ============================================================
-- ROLLBACK (only if you need to undo this migration)
-- ============================================================
-- ALTER TABLE students DROP COLUMN IF EXISTS batch_id;
-- DROP TABLE IF EXISTS batches;
-- ============================================================
