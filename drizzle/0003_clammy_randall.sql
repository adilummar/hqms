CREATE TYPE "public"."exam_track" AS ENUM('school', 'madrasa', 'hifz');--> statement-breakpoint
CREATE TYPE "public"."result_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."star_type" AS ENUM('blue', 'black');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'school_admin' BEFORE 'parent';--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" integer NOT NULL,
	"label" varchar(30) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "student_stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"type" "star_type" NOT NULL,
	"reason" text NOT NULL,
	"awarded_by" uuid NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_meeting_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"attended" boolean NOT NULL,
	"remarks" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parent_meeting_attendance_meeting_id_student_id_unique" UNIQUE("meeting_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "parent_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(150) NOT NULL,
	"meeting_date" date NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_grade_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_session_id" uuid NOT NULL,
	"grade" varchar(10) NOT NULL,
	"min_percentage" numeric(5, 2) NOT NULL,
	"label" varchar(50),
	"is_failing" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "exam_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_subject_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"marks_obtained" numeric(6, 2),
	"is_absent" boolean DEFAULT false NOT NULL,
	"remarks" varchar(200),
	"entered_by" uuid,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_marks_exam_subject_id_student_id_unique" UNIQUE("exam_subject_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "exam_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"track" "exam_track" NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" "exam_status" DEFAULT 'scheduled' NOT NULL,
	"result_status" "result_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_session_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"pass_marks" integer DEFAULT 35 NOT NULL,
	"display_order" integer DEFAULT 0,
	"exam_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(10) DEFAULT '📦',
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" varchar(30) DEFAULT 'pcs',
	"min_stock_alert" integer DEFAULT 0,
	"notes" text,
	"last_updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_activities" (
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
--> statement-breakpoint
CREATE TABLE "leave_activity_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_period_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"activity_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_activity_responses_leave_period_id_student_id_day_number_activity_id_unique" UNIQUE("leave_period_id","student_id","day_number","activity_id")
);
--> statement-breakpoint
CREATE TABLE "leave_day_activity_suspensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_period_day_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	CONSTRAINT "leave_day_activity_suspensions_leave_period_day_id_activity_id_unique" UNIQUE("leave_period_day_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "leave_period_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_period_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"date" date NOT NULL,
	"label" varchar(50),
	CONSTRAINT "leave_period_days_leave_period_id_day_number_unique" UNIQUE("leave_period_id","day_number")
);
--> statement-breakpoint
CREATE TABLE "leave_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_results" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "exam_results" CASCADE;--> statement-breakpoint
DROP TABLE "exams" CASCADE;--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "photo_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_years" ADD COLUMN "batch_number" integer;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "identification_mark" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "father_occupation" varchar(150) NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "guardian_name" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "guardian_relation" varchar(100);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "alternate_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "house_name" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "place" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "post_office" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "pincode" varchar(10);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "district" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "state" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "aadhaar_number" varchar(12);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "school_name" varchar(250);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "school_class" varchar(50);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "madrasa_name" varchar(250);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "madrasa_affiliation_number" varchar(100);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "madrasa_class" varchar(50);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN "payment_screenshot_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "admission_number" varchar(20);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "house_name" varchar(200);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "post" varchar(150);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "district" varchar(150);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "state" varchar(150);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "pin" varchar(10);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "is_hafiz" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "hafiz_since" date;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD COLUMN "daura2_juz_numbers" integer[];--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD COLUMN "daura2_remarks_id" uuid;--> statement-breakpoint
ALTER TABLE "student_stars" ADD CONSTRAINT "student_stars_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_stars" ADD CONSTRAINT "student_stars_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_meeting_attendance" ADD CONSTRAINT "parent_meeting_attendance_meeting_id_parent_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."parent_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_meeting_attendance" ADD CONSTRAINT "parent_meeting_attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_meeting_attendance" ADD CONSTRAINT "parent_meeting_attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_grade_rules" ADD CONSTRAINT "exam_grade_rules_exam_session_id_exam_sessions_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_exam_subject_id_exam_subjects_id_fk" FOREIGN KEY ("exam_subject_id") REFERENCES "public"."exam_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_exam_session_id_exam_sessions_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_activity_responses" ADD CONSTRAINT "leave_activity_responses_leave_period_id_leave_periods_id_fk" FOREIGN KEY ("leave_period_id") REFERENCES "public"."leave_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_activity_responses" ADD CONSTRAINT "leave_activity_responses_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_activity_responses" ADD CONSTRAINT "leave_activity_responses_activity_id_leave_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."leave_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_activity_responses" ADD CONSTRAINT "leave_activity_responses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_day_activity_suspensions" ADD CONSTRAINT "leave_day_activity_suspensions_leave_period_day_id_leave_period_days_id_fk" FOREIGN KEY ("leave_period_day_id") REFERENCES "public"."leave_period_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_day_activity_suspensions" ADD CONSTRAINT "leave_day_activity_suspensions_activity_id_leave_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."leave_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_period_days" ADD CONSTRAINT "leave_period_days_leave_period_id_leave_periods_id_fk" FOREIGN KEY ("leave_period_id") REFERENCES "public"."leave_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_periods" ADD CONSTRAINT "leave_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD CONSTRAINT "hifz_daily_entries_daura2_remarks_id_remarks_options_id_fk" FOREIGN KEY ("daura2_remarks_id") REFERENCES "public"."remarks_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" DROP COLUMN "previous_school";--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_batch_number_unique" UNIQUE("batch_number");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_admission_number_unique" UNIQUE("admission_number");