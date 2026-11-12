/**
 * Applies drizzle/0011_attendance_off_days.sql (additive, idempotent).
 *
 *   npx tsx --env-file=.env.local scripts/migrate-attendance-off-days.ts
 *
 * ALTER TYPE ... ADD VALUE cannot be used in the same transaction as the new value, so the
 * statements run one by one (each is IF NOT EXISTS, safe to re-run). Existing rows are untouched.
 */
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

async function main() {
  const file = path.resolve(process.cwd(), "drizzle/0011_attendance_off_days.sql");
  const statements = fs
    .readFileSync(file, "utf-8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const stmt of statements) await pool.query(stmt);
    console.log(`Applied ${statements.length} statements from ${path.basename(file)}`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
