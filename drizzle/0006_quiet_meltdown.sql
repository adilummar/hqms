CREATE TABLE "student_annual_hifz_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"target_juz_amount" numeric(4, 2) NOT NULL,
	"starting_juz_number" integer NOT NULL,
	"starting_page" integer NOT NULL,
	"calculated_total_pages" integer NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"override_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_annual_hifz_targets_student_id_academic_year_id_unique" UNIQUE("student_id","academic_year_id")
);
--> statement-breakpoint
ALTER TABLE "student_annual_hifz_targets" ADD CONSTRAINT "student_annual_hifz_targets_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_annual_hifz_targets" ADD CONSTRAINT "student_annual_hifz_targets_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_annual_hifz_targets" ADD CONSTRAINT "student_annual_hifz_targets_override_by_users_id_fk" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;