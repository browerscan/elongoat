import "server-only";

import { Pool } from "pg";

let pool: Pool | null = null;

export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (pool) return pool;
  pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.PGPOOL_MAX ?? "10", 10),
    statement_timeout: Number.parseInt(
      process.env.PG_STATEMENT_TIMEOUT_MS ?? "60000",
      10,
    ),
  });
  return pool;
}
