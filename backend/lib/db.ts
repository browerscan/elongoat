/**
 * Backend database module - provides throwing versions for scripts
 *
 * This module wraps the main db module (src/lib/db.ts) with throwing semantics.
 * Backend scripts require DATABASE_URL and should fail fast if missing.
 *
 * For frontend/API routes, use `src/lib/db.ts` directly with `getDbPool()`.
 */
import { Pool, PoolClient } from "pg";

// Re-export core functionality from main db module
export {
  getPoolMetrics,
  logPoolMetrics,
  closeDbPool,
  checkDbHealth,
  setupDbShutdownHandlers,
} from "../../src/lib/db";

// Import the main pool getter
import { getDbPool } from "../../src/lib/db";

/**
 * Gets the database pool, throwing if DATABASE_URL is not set.
 * Use this for backend scripts where database is required.
 *
 * For frontend/API routes that need graceful fallback, use getDbPool() instead.
 */
export function getDb(): Pool {
  const pool = getDbPool();
  if (!pool) {
    throw new Error("Missing DATABASE_URL - database connection required");
  }
  return pool;
}

/**
 * Executes a function within a database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @param fn - Function to execute within the transaction
 * @returns The result of the function
 * @throws If the function throws or DATABASE_URL is not set
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
