import * as fs from "fs";
import * as path from "path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
async function apply() {
  await db.execute(sql`CREATE TYPE "attendance_session" AS ENUM ('FN', 'AN')`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD COLUMN "session" "attendance_session"`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD COLUMN "absence_reason_id" uuid`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD COLUMN "deleted_at" timestamp`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD COLUMN "deleted_by" uuid`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_absence_reason_id_remarks_options_id_fk" FOREIGN KEY ("absence_reason_id") REFERENCES "public"."remarks_options"("id") ON DELETE restrict ON UPDATE no action`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`).catch(console.error);
  await db.execute(sql`ALTER TABLE "remarks_options" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_student_id_class_id_date_unique"`).catch(console.error);
  await db.execute(sql`ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_class_id_date_session_unique" UNIQUE("student_id", "class_id", "date", "session")`).catch(console.error);
  console.log("Migration applied");
  process.exit(0);
}
apply();
