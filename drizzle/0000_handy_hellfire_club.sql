CREATE TYPE "public"."application_status" AS ENUM('pending', 'shortlisted', 'selected', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'leave');--> statement-breakpoint
CREATE TYPE "public"."class_track" AS ENUM('hifz', 'madrasa', 'school');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('scheduled', 'ongoing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."fee_status" AS ENUM('pending', 'paid', 'partial', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."juz_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('sick_leave', 'casual_leave', 'approved_leave');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('sms', 'whatsapp', 'email', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."remarks_category" AS ENUM('sabaq', 'sabaq_juz', 'daura', 'attendance');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'completed', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."target_period" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'tutor', 'parent', 'student');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"metadata" text,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"password_reset_token" text,
	"password_reset_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_years_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(20) NOT NULL,
	"track" "class_track" NOT NULL,
	"tutor_id" uuid,
	"academic_year_id" uuid NOT NULL,
	"capacity" integer DEFAULT 30,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remarks_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "remarks_category" NOT NULL,
	"label" varchar(150) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_number" varchar(20) NOT NULL,
	"applicant_name" varchar(150) NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" varchar(10) NOT NULL,
	"father_name" varchar(150) NOT NULL,
	"mother_name" varchar(150),
	"guardian_phone" varchar(20) NOT NULL,
	"guardian_email" varchar(255),
	"address" text NOT NULL,
	"previous_school" varchar(200),
	"applied_tracks" "class_track"[] NOT NULL,
	"photo_url" text,
	"document_urls" jsonb DEFAULT '[]'::jsonb,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"academic_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admission_applications_application_number_unique" UNIQUE("application_number")
);
--> statement-breakpoint
CREATE TABLE "hall_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"hall_ticket_number" varchar(20) NOT NULL,
	"exam_date" date NOT NULL,
	"exam_center" varchar(200),
	"exam_time" varchar(20),
	"is_generated" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hall_tickets_hall_ticket_number_unique" UNIQUE("hall_ticket_number")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"year_of_study" varchar(10),
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "enrollments_student_id_class_id_academic_year_id_unique" UNIQUE("student_id","class_id","academic_year_id")
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"father_name" varchar(150),
	"mother_name" varchar(150),
	"primary_phone" varchar(20) NOT NULL,
	"whatsapp_number" varchar(20),
	"email" varchar(255),
	"occupation" varchar(100),
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parents_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_code" varchar(20) NOT NULL,
	"user_id" uuid,
	"application_id" uuid,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"date_of_birth" date NOT NULL,
	"gender" varchar(10) NOT NULL,
	"blood_group" varchar(5),
	"nationality" varchar(50) DEFAULT 'Indian',
	"religion" varchar(50),
	"address" text,
	"photo_url" text,
	"document_urls" jsonb DEFAULT '[]'::jsonb,
	"medical_notes" text,
	"emergency_contact" varchar(20),
	"status" "student_status" DEFAULT 'active' NOT NULL,
	"admission_date" date NOT NULL,
	"completion_date" date,
	"discontinuation_date" date,
	"discontinuation_reason" text,
	"admission_year_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_student_code_unique" UNIQUE("student_code"),
	CONSTRAINT "students_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "hifz_daily_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sabaq_from_page" numeric(5, 1),
	"sabaq_to_page" numeric(5, 1),
	"sabaq_pages" numeric(5, 1),
	"sabaq_juz_number" integer,
	"sabaq_remarks_id" uuid,
	"sabaq_juz_given" boolean,
	"sabaq_juz_remarks_id" uuid,
	"daura_juz_numbers" integer[],
	"daura_remarks_id" uuid,
	"recorded_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hifz_daily_entries_student_id_date_unique" UNIQUE("student_id","date")
);
--> statement-breakpoint
CREATE TABLE "juz_tracker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"juz_number" integer NOT NULL,
	"start_date" date,
	"completion_date" date,
	"status" "juz_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "juz_tracker_student_id_juz_number_unique" UNIQUE("student_id","juz_number")
);
--> statement-breakpoint
CREATE TABLE "monthly_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"target_juz" numeric(4, 1) NOT NULL,
	"set_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_targets_student_id_year_month_unique" UNIQUE("student_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"track" "class_track" NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"leave_type" "leave_type",
	"remarks" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_student_id_class_id_date_unique" UNIQUE("student_id","class_id","date")
);
--> statement-breakpoint
CREATE TABLE "staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"leave_type" "leave_type",
	"remarks" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_attendance_user_id_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "exam_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"marks_obtained" numeric(6, 2),
	"grade" varchar(5),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"class_id" uuid,
	"academic_year_id" uuid,
	"exam_date" date,
	"status" "exam_status" DEFAULT 'scheduled',
	"total_marks" integer,
	"pass_mark" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"is_recurring" varchar(5) DEFAULT 'false',
	"academic_year_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"fee_category_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "fee_status" DEFAULT 'pending',
	"paid_at" timestamp,
	"receipt_number" varchar(30),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"recipient_user_id" uuid,
	"student_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"sent_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hall_tickets" ADD CONSTRAINT "hall_tickets_application_id_admission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."admission_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_application_id_admission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."admission_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_admission_year_id_academic_years_id_fk" FOREIGN KEY ("admission_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD CONSTRAINT "hifz_daily_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD CONSTRAINT "hifz_daily_entries_sabaq_remarks_id_remarks_options_id_fk" FOREIGN KEY ("sabaq_remarks_id") REFERENCES "public"."remarks_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD CONSTRAINT "hifz_daily_entries_sabaq_juz_remarks_id_remarks_options_id_fk" FOREIGN KEY ("sabaq_juz_remarks_id") REFERENCES "public"."remarks_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD CONSTRAINT "hifz_daily_entries_daura_remarks_id_remarks_options_id_fk" FOREIGN KEY ("daura_remarks_id") REFERENCES "public"."remarks_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hifz_daily_entries" ADD CONSTRAINT "hifz_daily_entries_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juz_tracker" ADD CONSTRAINT "juz_tracker_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juz_tracker" ADD CONSTRAINT "juz_tracker_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_targets" ADD CONSTRAINT "monthly_targets_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_targets" ADD CONSTRAINT "monthly_targets_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_fee_category_id_fee_categories_id_fk" FOREIGN KEY ("fee_category_id") REFERENCES "public"."fee_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;