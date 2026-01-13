import "server-only";

import { Pool } from "pg";
import { getEnv } from "./env";
import { logger } from "./logger";
import { getRedis, isRedisEnabled } from "./redis";

const env = getEnv();
// ============================================================================
// Configuration
// ============================================================================

const QUERY_CACHE_ENABLED = env.QUERY_CACHE_ENABLED;
const QUERY_CACHE_TTL_MS = env.QUERY_CACHE_TTL_MS;

// ============================================================================
// Query Result Cache (L2 - Redis)
// ============================================================================

interface CachedQueryResult {
  data: unknown[];
  timestamp: number;
  query: string;
  params: unknown[];
  rowCount: number;
}

// Prefix for all DB cache keys to avoid collisions
const CACHE_PREFIX = "db:q:";

/**
 * Generates a consistent cache key for a query.
 */
function getQueryCacheKey(query: string, params: unknown[]): string {
  const paramString = JSON.stringify(params);
  const baseStr = query + paramString;
  const encoded = Buffer.from(baseStr).toString("base64").slice(0, 64);
  return CACHE_PREFIX + encoded;
}

/**
 * Gets a cached query result from Redis.
 */
async function getCachedQuery(
  query: string,
  params: unknown[],
): Promise<CachedQueryResult | null> {
  if (!QUERY_CACHE_ENABLED || !isRedisEnabled()) return null;

  const redis = getRedis();
  if (!redis) return null;

  const key = getQueryCacheKey(query, params);

  try {
    const cachedStr = await redis.get(key);
    if (!cachedStr) return null;

    const cached = JSON.parse(cachedStr) as CachedQueryResult;

    if (env.NODE_ENV === "development") {
      logger.info(
        { query: query.slice(0, 50) },
        "[DbOptimized] Redis cache hit",
      );
    }

    return cached;
  } catch (err) {
    if (env.NODE_ENV === "development") {
      logger.error({ err }, "[DbOptimized] Redis get error");
    }
    return null;
  }
}

/**
 * Caches a query result in Redis.
 */
async function setCachedQuery(
  query: string,
  params: unknown[],
  data: unknown[],
  rowCount: number,
  ttlMs: number = QUERY_CACHE_TTL_MS,
): Promise<void> {
  if (!QUERY_CACHE_ENABLED || !isRedisEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  const key = getQueryCacheKey(query, params);

  const cacheEntry: CachedQueryResult = {
    data,
    timestamp: Date.now(),
    query,
    params,
    rowCount,
  };

  try {
    // Set with TTL (converting ms to seconds for Redis EX, or usage PX)
    await redis.set(key, JSON.stringify(cacheEntry), "PX", ttlMs);
  } catch (err) {
    if (env.NODE_ENV === "development") {
      logger.error({ err }, "[DbOptimized] Redis set error");
    }
  }
}

/**
 * Clears the query cache (flushes keys with the prefix).
 * Warning: scan-based clearing can be slow on massive datasets.
 */
export async function clearQueryCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    let cursor = "0";
    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        `${CACHE_PREFIX}*`,
        "COUNT",
        100,
      );
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    logger.error({ err }, "[DbOptimized] Clear cache error");
  }
}

/**
 * Invalidates query cache entries matching a SQL pattern (expensive!).
 * This iterates all cached queries to check their metadata.
 */
export async function invalidateQueryCache(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const regex = new RegExp(pattern);
  let count = 0;

  try {
    let cursor = "0";
    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        `${CACHE_PREFIX}*`,
        "COUNT",
        50,
      );
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        // We have to get the values to check the query string
        // This is heavy, use sparingly
        const pipeline = redis.pipeline();
        keys.forEach((k) => pipeline.get(k));
        const entries = await pipeline.exec();

        if (entries) {
          const keysToDelete: string[] = [];
          entries.forEach((entry, idx) => {
            const [err, val] = entry;
            if (!err && typeof val === "string") {
              const parsed = JSON.parse(val) as CachedQueryResult;
              if (regex.test(parsed.query)) {
                keysToDelete.push(keys[idx]);
              }
            }
          });

          if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
            count += keysToDelete.length;
          }
        }
      }
    } while (cursor !== "0");

    logger.info(
      { count },
      "[DbOptimized] Invalidated Redis query cache entries",
    );
  } catch (err) {
    logger.error({ err }, "[DbOptimized] Invalidate cache error");
  }
}

// ============================================================================
// Prepared Statements Cache
// ============================================================================

const preparedStatements = new Map<string, boolean>();

/**
 * Checks if a statement has been prepared.
 */
function isPrepared(statementName: string): boolean {
  return preparedStatements.has(statementName);
}

/**
 * Marks a statement as prepared.
 */
function markPrepared(statementName: string): void {
  preparedStatements.set(statementName, true);
}

/**
 * Generates a statement name from the query.
 */
function getStatementName(query: string): string {
  // Create a deterministic name from the query hash
  const hash = Buffer.from(query).toString("base64").slice(0, 32);
  return "stmt_" + hash.replace(/[^a-zA-Z0-9_]/g, "_");
}

// ============================================================================
// Connection Pool Monitoring
// ============================================================================

interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  max: number;
}

let lastPoolCheck = 0;
let cachedPoolStats: PoolStats | null = null;

/**
 * Gets pool statistics with caching to avoid excessive checks.
 */
export function getPoolStats(pool: Pool): PoolStats {
  const now = Date.now();

  // Cache stats for 5 seconds to avoid excessive property access
  if (cachedPoolStats && now - lastPoolCheck < 5000) {
    return cachedPoolStats;
  }

  const stats: PoolStats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    max: pool.options.max || 10,
  };

  cachedPoolStats = stats;
  lastPoolCheck = now;

  return stats;
}

/**
 * Checks if the pool is healthy.
 */
export function isPoolHealthy(pool: Pool): {
  healthy: boolean;
  reason?: string;
} {
  const stats = getPoolStats(pool);

  // Check if pool is exhausted
  if (stats.waitingCount > 5) {
    return {
      healthy: false,
      reason: "Too many clients waiting for connections",
    };
  }

  // Check if pool is at capacity
  if (stats.totalCount >= stats.max && stats.idleCount === 0) {
    return { healthy: false, reason: "Connection pool exhausted" };
  }

  return { healthy: true };
}

// ============================================================================
// Optimized Query Functions
// ============================================================================

export interface QueryOptions {
  useCache?: boolean;
  cacheTtl?: number;
  prepare?: boolean;
  name?: string;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  cached: boolean;
  latency: number;
}

/**
 * Executes a query with optional caching and prepared statements.
 */
export async function optimizedQuery<T>(
  pool: Pool,
  query: string,
  params: unknown[] = [],
  options: QueryOptions = {},
): Promise<QueryResult<T>> {
  const startTime = performance.now();
  const { useCache = true, prepare = false, name } = options;

  // Check cache first for SELECT queries
  if (useCache && query.trim().toUpperCase().startsWith("SELECT")) {
    const cached = await getCachedQuery(query, params);
    if (cached) {
      return {
        rows: cached.data as T[],
        rowCount: cached.rowCount,
        cached: true,
        latency: Math.round(performance.now() - startTime),
      };
    }
  }

  // Execute query
  let result;
  if (prepare) {
    const statementName = name || getStatementName(query);

    if (!isPrepared(statementName)) {
      try {
        await pool.query({ name: statementName, text: query, values: [] });
        markPrepared(statementName);
      } catch (error) {
        // Statement might already exist, continue
        const err = error as { code?: string };
        if (err.code !== "42P05") {
          throw error;
        }
      }
    }

    result = await pool.query({
      name: statementName,
      text: query,
      values: params,
    });
  } else {
    result = await pool.query(query, params);
  }

  // Cache SELECT results
  if (useCache && query.trim().toUpperCase().startsWith("SELECT")) {
    // don't await the set, let it happen in background
    setCachedQuery(
      query,
      params,
      result.rows,
      result.rowCount ?? 0,
      options.cacheTtl,
    ).catch((err) =>
      env.NODE_ENV === "development"
        ? logger.error({ err }, "Cache set failed")
        : null,
    );
  }

  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? 0,
    cached: false,
    latency: Math.round(performance.now() - startTime),
  };
}

/**
 * Executes a batch of queries in parallel.
 */
export async function batchQuery<T>(
  pool: Pool,
  queries: Array<{ query: string; params?: unknown[] }>,
): Promise<QueryResult<T>[]> {
  const startTime = performance.now();

  const results = await Promise.all(
    queries.map(({ query, params = [] }) =>
      optimizedQuery<T>(pool, query, params, { useCache: true }),
    ),
  );

  return results.map((r) => ({
    ...r,
    latency: Math.round(performance.now() - startTime),
  }));
}

/**
 * Executes a query with automatic retry on connection errors.
 */
export async function queryWithRetry<T>(
  pool: Pool,
  query: string,
  params: unknown[] = [],
  options: QueryOptions & { maxRetries?: number } = {},
): Promise<QueryResult<T>> {
  const { maxRetries = 3, ...queryOptions } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await optimizedQuery<T>(pool, query, params, queryOptions);
    } catch (error) {
      lastError = error;

      // Check if it's a connection error
      const err = error as { code?: string };
      const isConnectionError =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNREFUSED" ||
        err.code === "57P01";

      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt), 1000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      logger.warn(
        { attempt: attempt + 1 },
        "[DbOptimized] Retry attempt for query",
      );
    }
  }
  throw lastError;
}

// ============================================================================
// Transaction Support
// ============================================================================

export interface TransactionClient {
  query<T>(query: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/**
 * Creates a transaction with optimized queries.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: TransactionClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const transactionClient: TransactionClient = {
      query: async <T>(query: string, params: unknown[] = []) => {
        const result = await client.query(query, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? 0,
          cached: false,
          latency: 0,
        };
      },
    };

    const result = await fn(transactionClient);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// Stream Query Support for Large Result Sets
// ============================================================================

/**
 * Streams query results in chunks to avoid memory issues.
 */
export async function* streamQuery<T>(
  pool: Pool,
  query: string,
  params: unknown[] = [],
  chunkSize = 1000,
): AsyncGenerator<T[], void, unknown> {
  const client = await pool.connect();

  try {
    // For PostgreSQL, we use a cursor-based approach
    const cursorName =
      "cursor_" + Date.now() + "_" + Math.random().toString(36).slice(2);

    try {
      // Declare cursor
      await client.query(
        "DECLARE " + cursorName + " NO SCROLL CURSOR FOR " + query,
        params,
      );

      while (true) {
        // Fetch chunk
        const fetchQuery = "FETCH " + chunkSize + " FROM " + cursorName;
        const result = await client.query(fetchQuery);

        if (result.rows.length === 0) {
          break;
        }

        yield result.rows as T[];
      }
    } finally {
      // Close cursor
      await client.query("CLOSE " + cursorName);
    }
  } finally {
    client.release();
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Performs a health check on the database with detailed metrics.
 */
export async function checkDatabaseHealth(pool: Pool): Promise<{
  healthy: boolean;
  latency: number;
  poolStats: PoolStats;
  error?: string;
  reason?: string;
}> {
  const startTime = performance.now();

  try {
    await pool.query("SELECT 1");

    const latency = Math.round(performance.now() - startTime);
    const poolStats = getPoolStats(pool);

    const healthCheck = isPoolHealthy(pool);

    return {
      healthy: healthCheck.healthy,
      latency,
      poolStats,
      reason: healthCheck.reason,
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      healthy: false,
      latency,
      poolStats: { totalCount: 0, idleCount: 0, waitingCount: 0, max: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Statistics
// ============================================================================

export interface DbStats {
  pool: PoolStats;
  cache: {
    enabled: boolean;
    type: "redis" | "memory";
    ttl: number;
  };
  prepared: {
    count: number;
  };
}

/**
 * Gets database optimization statistics.
 */
export function getDbStats(pool: Pool): DbStats {
  return {
    pool: getPoolStats(pool),
    cache: {
      enabled: QUERY_CACHE_ENABLED && isRedisEnabled(),
      type: "redis",
      ttl: QUERY_CACHE_TTL_MS,
    },
    prepared: {
      count: preparedStatements.size,
    },
  };
}
