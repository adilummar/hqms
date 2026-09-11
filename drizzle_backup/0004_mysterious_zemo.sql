CREATE TABLE "examinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" "exam_status" DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_stars" ADD COLUMN "value" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "student_stars" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_stars" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "student_stars" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD COLUMN "examination_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD COLUMN "tutor_mark_entry_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_stars" ADD CONSTRAINT "student_stars_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_examination_id_examinations_id_fk" FOREIGN KEY ("examination_id") REFERENCES "public"."examinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "mobile_number";--> statement-breakpoint
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_examination_id_track_unique" UNIQUE("examination_id","track");