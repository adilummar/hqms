/**
 * Diagnostic script: checks if the admin user exists in the DB
 * Run: npx tsx --env-file=.env.local scripts/check-auth.ts
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("🔍 Checking database connection...");

  // 1. Test connection
  try {
    await pool.query("SELECT 1");
    console.log("✅ DB connection OK");
  } catch (err) {
    console.error("❌ DB connection FAILED:", err);
    await pool.end();
    return;
  }

  // 2. Check users table
  const { rows: users } = await pool.query(
    `SELECT id, username, email, role, is_active, password_hash FROM users ORDER BY created_at`
  );

  if (users.length === 0) {
    console.log("\n⚠️  No users found in the database!");
    console.log("   Run: npm run db:seed  to seed the initial admin user.");
  } else {
    console.log(`\n👥 Found ${users.length} user(s):\n`);
    for (const u of users) {
      console.log(`  Username : ${u.username}`);
      console.log(`  Role     : ${u.role}`);
      console.log(`  Active   : ${u.is_active}`);
      console.log(`  Has hash : ${!!u.password_hash}`);

      // Test known default password
      const testPasswords = ["hqms@admin", "admin", "password", "123456"];
      for (const pw of testPasswords) {
        const match = await bcrypt.compare(pw, u.password_hash);
        if (match) {
          console.log(`  🔑 Password matches: "${pw}"`);
          break;
        }
      }
      console.log("");
    }
  }

  await pool.end();
}

main().catch(console.error);
