import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" }); // load .env.local explicitly

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log("Running migration for Stock Registration...");
  const client = await pool.connect();
  try {
    // Add columns to inventory_items
    await client.query(`
      ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "purchasing_date" timestamp;
      ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "repairing_date" timestamp;
    `);
    console.log("Added purchasing_date and repairing_date to inventory_items");

    // Create stock custom fields table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "inventory_custom_fields" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(150) NOT NULL,
        "type" varchar(50) NOT NULL,
        "options" text[],
        "is_required" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "display_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Created inventory_custom_fields table");

    // Create stock custom values table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "inventory_custom_values" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        "field_id" uuid NOT NULL REFERENCES "inventory_custom_fields"("id") ON DELETE CASCADE,
        "value" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Created inventory_custom_values table");

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
