CREATE TYPE "public"."star_type" AS ENUM('blue', 'black');
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
ALTER TABLE "student_stars" ADD CONSTRAINT "student_stars_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_stars" ADD CONSTRAINT "student_stars_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
