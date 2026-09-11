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
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parent_meeting_attendance" ADD CONSTRAINT "parent_meeting_attendance_meeting_id_parent_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."parent_meetings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parent_meeting_attendance" ADD CONSTRAINT "parent_meeting_attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parent_meeting_attendance" ADD CONSTRAINT "parent_meeting_attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
