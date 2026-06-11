import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seedTutors() {
  const passwordHash = await bcrypt.hash("tutor123", 10);
  
  for (let i = 1; i <= 3; i++) {
    await db.insert(schema.users).values({
      username: `tutor${i}`,
      email: `tutor${i}@hqms.local`,
      passwordHash,
      role: "tutor",
      isActive: true,
    }).onConflictDoNothing();
  }
  
  console.log("✅ Seeded tutors: tutor1, tutor2, tutor3 (password: tutor123)");
  await pool.end();
}

seedTutors().catch(console.error);
