/**
 * Finds which Supabase pooler region hosts your project.
 * Run: npx tsx --env-file=.env.local scripts/find-region.ts
 */
import { Client } from "pg";

const PROJECT_REF = "kqjwubdxvumfljystbzp";
// Read password from current DATABASE_URL
const currentUrl = process.env.DATABASE_URL ?? "";
const passwordMatch = currentUrl.match(/:([^@]+)@aws-/);
const password = passwordMatch ? passwordMatch[1] : "";

const regions = [
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "sa-east-1",
];

async function tryRegion(region: string): Promise<boolean> {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 5432,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: decodeURIComponent(password),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!password) {
    console.error("❌ Could not extract password from DATABASE_URL");
    process.exit(1);
  }

  console.log(`🔍 Searching for project ${PROJECT_REF} across ${regions.length} regions...\n`);

  for (const region of regions) {
    process.stdout.write(`  Testing ${region.padEnd(20)} ... `);
    const ok = await tryRegion(region);
    if (ok) {
      console.log("✅ FOUND!");
      console.log(`\n🎉 Your project is in region: ${region}`);
      console.log(`\n📋 Correct DATABASE_URL:`);
      console.log(`DATABASE_URL=postgresql://postgres.${PROJECT_REF}:${password}@aws-0-${region}.pooler.supabase.com:5432/postgres`);
      process.exit(0);
    } else {
      console.log("✗");
    }
  }

  console.log("\n❌ Project not found in any region.");
  console.log("   → Your project may be paused. Resume it at supabase.com/dashboard");
}

main().catch(console.error);
