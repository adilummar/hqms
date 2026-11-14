-- Staff meetings: meeting category + meeting-specific participants + external (non-HQMS) guests.
-- Additive and idempotent. No existing rows are modified or removed:
--   * existing meetings get category = NULL (shown as "Uncategorised") and
--     participants_explicit = false (they keep the live Hifz-tutor roster behaviour).
--   * staff_meeting_attendance is untouched (user_id stays NOT NULL / FK to users).
--   * external guests live in their own table; no users are created for them.
ALTER TABLE "staff_meetings" ADD COLUMN IF NOT EXISTS "category" varchar(20);--> statement-breakpoint
ALTER TABLE "staff_meetings" ADD COLUMN IF NOT EXISTS "custom_category" varchar(100);--> statement-breakpoint
ALTER TABLE "staff_meetings" ADD COLUMN IF NOT EXISTS "participants_explicit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_meetings" ADD CONSTRAINT "staff_meetings_category_check"
    CHECK ("category" IS NULL OR "category" IN ('school','madrasa','management','custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_meetings" ADD CONSTRAINT "staff_meetings_custom_category_check"
    CHECK ("category" IS DISTINCT FROM 'custom' OR length(btrim(coalesce("custom_category",''))) > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_meeting_external_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL REFERENCES "staff_meetings"("id") ON DELETE cascade,
	"name" varchar(120) NOT NULL,
	"designation" varchar(120),
	"contact_number" varchar(40),
	"attended" boolean DEFAULT true NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_meeting_ext_unique_idx"
  ON "staff_meeting_external_participants" ("meeting_id", lower("name"), lower(coalesce("designation", '')));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_meeting_ext_meeting_idx"
  ON "staff_meeting_external_participants" ("meeting_id");
