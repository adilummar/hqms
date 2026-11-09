-- Exam-specific Hifz Juz values (Juz to be obtained / Juz memorized) per student and Hifz exam session.
-- Additive and idempotent: creates one new table, touches no existing data.

CREATE TABLE IF NOT EXISTS "exam_hifz_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_session_id" uuid NOT NULL REFERENCES "exam_sessions"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "juz_to_obtain" numeric(4, 1),
  "juz_memorized" numeric(4, 1),
  "remarks" varchar(300),
  "entered_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "exam_hifz_results_session_student_unique" UNIQUE ("exam_session_id", "student_id"),
  CONSTRAINT "exam_hifz_results_juz_to_obtain_range" CHECK ("juz_to_obtain" IS NULL OR ("juz_to_obtain" >= 0 AND "juz_to_obtain" <= 30)),
  CONSTRAINT "exam_hifz_results_juz_memorized_range" CHECK ("juz_memorized" IS NULL OR ("juz_memorized" >= 0 AND "juz_memorized" <= 30))
);
