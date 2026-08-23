ALTER TYPE "public"."user_role" ADD VALUE 'madrasa_admin';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mobile_number" varchar(20);