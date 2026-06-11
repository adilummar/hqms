ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "identification_mark" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "father_occupation" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "alternate_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "guardian_name" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "guardian_relation" varchar(100);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "house_name" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "place" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "post_office" varchar(200);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "pincode" varchar(10);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "district" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "state" varchar(150);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "aadhaar_number" varchar(12);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "school_name" varchar(250);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "school_class" varchar(50);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "madrasa_name" varchar(250);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "madrasa_affiliation_number" varchar(100);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "madrasa_class" varchar(50);--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "payment_screenshot_url" text;--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ALTER COLUMN "photo_url" SET NOT NULL;
