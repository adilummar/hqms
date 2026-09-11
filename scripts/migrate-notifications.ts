import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log("Running migration for Notifications...");
  const client = await pool.connect();
  try {
    // Check if enum exists
    const enumCheck = await client.query(`
      SELECT 1 FROM pg_type WHERE typname = 'notification_type'
    `);

    if (enumCheck.rows.length === 0) {
      await client.query(`
        CREATE TYPE "public"."notification_type" AS ENUM(
          'exam_results_published', 
          'parent_meeting_announced', 
          'parent_meeting_reminder', 
          'parent_meeting_attendance_recorded', 
          'hifz_entry_created', 
          'juz_completed', 
          'hafiz_milestone', 
          'leave_period_activated'
        );
      `);
      console.log("Created notification_type enum");
    } else {
      console.log("notification_type enum already exists");
    }

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recipient_user_id" uuid NOT NULL,
        "type" "notification_type" NOT NULL,
        "title" varchar(200) NOT NULL,
        "body" text NOT NULL,
        "entity_type" varchar(50),
        "entity_id" uuid,
        "deep_link" varchar(500),
        "idempotency_key" varchar(255) NOT NULL,
        "is_read" boolean DEFAULT false NOT NULL,
        "read_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key"),
        CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade
      );
    `);
    console.log("Created notifications table");

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON notifications(recipient_user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_user_id, is_read) WHERE is_read = false;
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    `);
    console.log("Created notification indexes");

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigration();
