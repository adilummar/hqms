import * as fs from "fs";
import * as path from "path";

// Manually load .env.local
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

import { db } from "../lib/db";
import { remarksOptions } from "../lib/db/schema";
import { and, eq } from "drizzle-orm";

const REASONS = [
  "Sick in Hostel",
  "Sick in Home",
  "Personal",
  "Urgent",
  "Other"
];

async function seed() {
  for (let i = 0; i < REASONS.length; i++) {
    const r = REASONS[i];
    const existing = await db.query.remarksOptions.findFirst({
      where: and(
        eq(remarksOptions.category, "attendance"),
        eq(remarksOptions.label, r)
      )
    });
    if (!existing) {
      await db.insert(remarksOptions).values({
        category: "attendance",
        label: r,
        isActive: true,
        displayOrder: i + 10,
      });
      console.log(`Inserted: ${r}`);
    } else {
      console.log(`Already exists: ${r}`);
    }
  }
  console.log("Done");
  process.exit(0);
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
