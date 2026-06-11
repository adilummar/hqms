import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function assignTutors() {
  const tutors = await db.query.users.findMany({ where: eq(schema.users.role, "tutor") });
  const hifzClasses = await db.query.classes.findMany({ where: eq(schema.classes.track, "hifz") });
  
  for(let i=0; i<Math.min(tutors.length, hifzClasses.length); i++) {
    await db.update(schema.classes).set({ tutorId: tutors[i].id }).where(eq(schema.classes.id, hifzClasses[i].id));
  }
  
  console.log("✅ Assigned tutors to Hifz classes");
  await pool.end();
}

assignTutors().catch(console.error);
