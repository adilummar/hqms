CREATE TABLE IF NOT EXISTS "staff_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(150) NOT NULL,
	"meeting_date" date NOT NULL,
	"meeting_time" varchar(50),
	"location" varchar(150),
	"description" text,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"minutes" text,
	"decisions" text,
	"created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_meeting_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL REFERENCES "staff_meetings"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"attended" boolean DEFAULT true NOT NULL,
	"remarks" text,
	"recorded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_meeting_attendance_meeting_id_user_id_unique" UNIQUE("meeting_id","user_id")
);
