-- ============================================================
-- 0006_separate_batches.sql
-- Creates a standalone `batches` table (student cohorts),
-- seeds it from existing academic_years.batch_number data,
-- and adds batch_id FK to students.
--
-- Run this on BOTH your local DB and Supabase (SQL Editor).
-- ============================================================

-- 1. Create the batches table
CREATE TABLE IF NOT EXISTS "batches" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_number" integer UNIQUE NOT NULL,
  "label"        varchar(30) NOT NULL,
  "notes"        text,
  "created_at"   timestamp NOT NULL DEFAULT now()
);

-- 2. Seed batches from existing academic_years that already have a batch_number
--    This ensures no data loss for existing deployments.
INSERT INTO "batches" ("batch_number", "label", "created_at")
SELECT
  ay.batch_number,
  'Batch ' || ay.batch_number,
  ay.created_at
FROM "academic_years" ay
WHERE ay.batch_number IS NOT NULL
ON CONFLICT (batch_number) DO NOTHING;

-- 3. Add batch_id column to students (nullable — existing rows get populated in step 4)
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "batch_id" uuid
  REFERENCES "batches"("id") ON DELETE SET NULL;

-- 4. Back-fill batch_id on existing students
--    Logic: student.admission_year_id → academic_years.batch_number → batches.id
UPDATE "students" s
SET    "batch_id" = b.id
FROM   "academic_years" ay
JOIN   "batches" b ON b.batch_number = ay.batch_number
WHERE  s.admission_year_id = ay.id
  AND  ay.batch_number IS NOT NULL
  AND  s.batch_id IS NULL;

-- 5. Optional index for fast batch-filtered student queries
CREATE INDEX IF NOT EXISTS "students_batch_id_idx" ON "students"("batch_id");
