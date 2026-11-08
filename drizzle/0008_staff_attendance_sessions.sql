-- Staff attendance FN/AN sessions.
-- Additive and idempotent: no existing row is modified or deleted.
-- Legacy rows keep session = NULL and are never converted to FN/AN.

ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "session" "attendance_session";
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "check_in_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "source" varchar(10);
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "original_status" "attendance_status";
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "original_source" varchar(10);
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "corrected_by" uuid REFERENCES "users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "corrected_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_attendance" DROP CONSTRAINT IF EXISTS "staff_attendance_user_id_date_unique";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_attendance_user_id_date_session_unique'
  ) THEN
    ALTER TABLE "staff_attendance"
      ADD CONSTRAINT "staff_attendance_user_id_date_session_unique" UNIQUE ("user_id", "date", "session");
  END IF;
END $$;
--> statement-breakpoint
-- Keep "one legacy row per user per day" (NULLs are distinct in a plain unique constraint).
CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendance_legacy_user_date_uniq"
  ON "staff_attendance" ("user_id", "date") WHERE "session" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_off_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"scope" varchar(4) DEFAULT 'both' NOT NULL,
	"type" varchar(20) DEFAULT 'holiday' NOT NULL,
	"reason" varchar(150),
	"created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_off_days_date_scope_unique" UNIQUE ("date", "scope")
);
--> statement-breakpoint
-- First day that uses the FN/AN system = tomorrow (IST). Earlier dates stay legacy.
-- Weekly off days are intentionally NOT seeded: admin sets them on the Staff Attendance page.
INSERT INTO "settings" ("key", "value", "description")
VALUES (
  'staff_session_start_date',
  ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text,
  'First IST date (YYYY-MM-DD) on which staff FN/AN attendance applies; earlier dates are legacy single-session records.'
)
ON CONFLICT ("key") DO NOTHING;
