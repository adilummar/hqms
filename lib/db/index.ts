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
    // Supabase Session Pooler (PgBouncer) aggressively drops idle connections.
    // Keep the client-side pool small and always use keepAlive so dead
    // sockets are detected before a query hits them (prevents ECONNRESET).
    max: 3,
    idleTimeoutMillis: 10_000,   // drop idle connections after 10 s
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
