// Server-only module (import removed for backend compatibility)

import { Pool, PoolConfig } from "pg";

// ============================================================================
// Types
// ============================================================================

interface PoolMetrics {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxCount: number;
}

interface DbPoolWithMetrics extends Pool {
  _metrics?: PoolMetrics | null;
  _connectionTimeout?: NodeJS.Timeout;
}

// ============================================================================
// Pool Configuration
// ============================================================================

let pool: DbPoolWithMetrics | null = null;
let isShuttingDown = false;

const DEFAULT_POOL_CONFIG: PoolConfig = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 60000,
  query_timeout: 60000,
};

/**
 * Get pool configuration from environment variables
 */
function getPoolConfig(): PoolConfig {
  return {
    ...DEFAULT_POOL_CONFIG,
    max: Number.parseInt(process.env.PGPOOL_MAX ?? "10", 10),
    idleTimeoutMillis: Number.parseInt(
      process.env.PGPOOL_IDLE_TIMEOUT_MS ?? "30000",
      10,
    ),
    connectionTimeoutMillis: Number.parseInt(
      process.env.PGPOOL_CONNECT_TIMEOUT_MS ?? "10000",
      10,
    ),
    statement_timeout: Number.parseInt(
      process.env.PG_STATEMENT_TIMEOUT_MS ?? "60000",
      10,
    ),
  };
}

// ============================================================================
// Pool Metrics
// ============================================================================

/**
 * Get current pool metrics for monitoring
 */
export function getPoolMetrics(): PoolMetrics | null {
  if (!pool) return null;

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxCount: pool.options.max || 10,
  };
}

/**
 * Log pool metrics for debugging
 */
export function logPoolMetrics(): void {
  const metrics = getPoolMetrics();
  if (!metrics) {
    console.log("[DB] Pool not initialized");
    return;
  }

  const { totalCount, idleCount, waitingCount, maxCount } = metrics;
  const activeCount = totalCount - idleCount;
  const utilizationPercent = (activeCount / maxCount) * 100;

  console.log(
    `[DB] Pool metrics: ${activeCount}/${maxCount} active (${utilizationPercent.toFixed(1)}%), ${idleCount} idle, ${waitingCount} waiting`,
  );
}

// ============================================================================
// Pool Management
// ============================================================================

/**
 * Get or create the database connection pool
 */
export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (isShuttingDown) {
    console.warn("[DB] Attempted to get pool during shutdown");
    return null;
  }

  if (pool) {
    // Update metrics
    pool._metrics = getPoolMetrics();
    return pool;
  }

  const config = getPoolConfig();
  pool = new Pool({
    ...config,
    connectionString,
  }) as DbPoolWithMetrics;

  // Set up error handler
  pool.on("error", (err) => {
    console.error("[DB] Unexpected pool error", err);
  });

  // Set up connection timeout handler
  pool.on("connect", (client) => {
    client
      .query("SET statement_timeout = " + config.statement_timeout)
      .catch((e) => console.error("[DB] Failed to set statement_timeout", e));
  });

  // Log pool status periodically (only in development)
  if (process.env.NODE_ENV === "development") {
    const metricsInterval = setInterval(() => {
      if (pool && !isShuttingDown) {
        logPoolMetrics();
      } else {
        clearInterval(metricsInterval);
      }
    }, 60000); // Every minute

    // Don't keep the process alive for this interval
    metricsInterval.unref();
  }

  console.log("[DB] Pool created with max connections:", config.max);
  return pool;
}

/**
 * Gracefully close the database pool
 */
export async function closeDbPool(): Promise<void> {
  if (!pool || isShuttingDown) return;

  isShuttingDown = true;
  console.log("[DB] Closing pool...");

  try {
    // Set a hard timeout for pool shutdown
    const timeout = Promise.race([
      pool.end(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Pool close timeout")), 10000),
      ),
    ]);

    await timeout;
    pool = null;
    console.log("[DB] Pool closed successfully");
  } catch (error) {
    console.error("[DB] Error closing pool:", error);
    pool = null;
  }
}

/**
 * Health check for the database pool
 */
export async function checkDbHealth(): Promise<{
  healthy: boolean;
  metrics: PoolMetrics | null;
  error?: string;
}> {
  try {
    const dbPool = getDbPool();
    if (!dbPool) {
      return {
        healthy: false,
        metrics: null,
        error: "Pool not initialized",
      };
    }

    const client = await dbPool.connect();
    const result = await client.query("SELECT 1 as health_check");
    client.release();

    if (result.rows[0]?.health_check !== 1) {
      throw new Error("Unexpected health check result");
    }

    return {
      healthy: true,
      metrics: getPoolMetrics(),
    };
  } catch (error) {
    return {
      healthy: false,
      metrics: getPoolMetrics(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Set up graceful shutdown handlers for database pool cleanup
 */
export function setupDbShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[DB] Received ${signal}, closing pool gracefully...`);
    await closeDbPool();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

// Auto-setup shutdown handlers in production
if (process.env.NODE_ENV === "production") {
  setupDbShutdownHandlers();
}
