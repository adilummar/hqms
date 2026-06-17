-- 0005_batch_and_admno.sql
-- Adds: batch_number to academic_years, admission_number + 5 address fields to students

-- 1. Add batch_number column to academic_years
ALTER TABLE "academic_years"
  ADD COLUMN IF NOT EXISTS "batch_number" integer;

-- Make existing rows get sequential batch numbers based on creation order
DO $$
DECLARE
  r RECORD;
  i INTEGER := 1;
BEGIN
  FOR r IN SELECT id FROM academic_years ORDER BY created_at ASC LOOP
    UPDATE academic_years SET batch_number = i WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

-- Now add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_batch_number_unique"
  ON "academic_years"("batch_number");

-- 2. Add admission_number to students (nullable, unique)
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "admission_number" varchar(20);

CREATE UNIQUE INDEX IF NOT EXISTS "students_admission_number_unique"
  ON "students"("admission_number")
  WHERE "admission_number" IS NOT NULL;

-- 3. Add structured address fields to students
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "house_name" varchar(200),
  ADD COLUMN IF NOT EXISTS "post"       varchar(150),
  ADD COLUMN IF NOT EXISTS "district"   varchar(150),
  ADD COLUMN IF NOT EXISTS "state"      varchar(150),
  ADD COLUMN IF NOT EXISTS "pin"        varchar(10);
