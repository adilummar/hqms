import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Adding parent_meeting_status enum...");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE parent_meeting_status AS ENUM ('ON_TIME', 'LATE', 'ABSENT_WITH_REASON', 'ABSENT_WITHOUT_VALID_REASON');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("Adding status column to parent_meeting_attendance...");
    await client.query(`
      ALTER TABLE parent_meeting_attendance
      ADD COLUMN IF NOT EXISTS status parent_meeting_status;
    `);

    // Let's drop the NOT NULL constraint on attended so we don't have to populate it.
    console.log("Dropping NOT NULL on attended...");
    await client.query(`
      ALTER TABLE parent_meeting_attendance
      ALTER COLUMN attended DROP NOT NULL;
    `);

    await client.query("COMMIT");
    console.log("Migration successful!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
