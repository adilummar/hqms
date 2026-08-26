import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Increased to 10 to handle parallel Promise.all queries in Next.js
    max: 10,
    // Increased timeouts to prevent premature crashes on slow network
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
  });

// Prevent unhandled pool errors from crashing the process
pool.on("error", (err) => {
  console.error("[db] Pool error (connection dropped):", err.message);
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;

