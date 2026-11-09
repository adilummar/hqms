/**
 * Applies drizzle/0009_exam_track_subjects.sql (additive, idempotent).
 *
 *   npx tsx --env-file=.env.local scripts/migrate-exam-track-subjects.ts
 *
 * Runs all statements in ONE transaction: it either fully applies or not at all.
 * Only creates the new exam_track_subjects table; no existing data is touched.
 */
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

async function main() {
  const file = path.resolve(process.cwd(), "drizzle/0009_exam_track_subjects.sql");
  const statements = fs
    .readFileSync(file, "utf-8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const stmt of statements) await client.query(stmt);
    await client.query("COMMIT");
    console.log(`Applied ${statements.length} statements from ${path.basename(file)}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed and was rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
