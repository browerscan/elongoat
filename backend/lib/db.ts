import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }
  pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.PGPOOL_MAX ?? "5", 10),
    statement_timeout: Number.parseInt(
      process.env.PG_STATEMENT_TIMEOUT_MS ?? "60000",
      10,
    ),
  });
  return pool;
}

export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const client = await db.connect();
  await client.query("begin");
  try {
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
