import { Pool } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM drizzle__migrations ORDER BY created_at DESC LIMIT 5");
    console.log("drizzle__migrations:", res.rows);
  } catch (err: any) {
    console.log("err1", err.message);
    try {
        const res2 = await client.query("SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5");
        console.log("__drizzle_migrations:", res2.rows);
    } catch(err2: any) {
        console.log("err2", err2.message);
        
        // let's just list all tables to see what it is
        const res3 = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        console.log("Tables:", res3.rows.map(r => r.table_name));
    }
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
