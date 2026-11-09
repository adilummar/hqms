-- Per-track exam subject catalogue (school | madrasa | hifz).
-- Additive and idempotent: creates one new table, touches no existing data.

CREATE TABLE IF NOT EXISTS "exam_track_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track" "exam_track" NOT NULL,
  "name" varchar(150) NOT NULL,
  "total_marks" integer DEFAULT 100 NOT NULL,
  "pass_marks" integer DEFAULT 35 NOT NULL,
  "display_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "exam_track_subjects_track_name_unique" UNIQUE ("track", "name")
);
