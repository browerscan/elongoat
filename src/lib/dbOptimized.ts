import "server-only";

import { Pool } from "pg";

// ============================================================================
// Configuration
// ============================================================================

const QUERY_CACHE_ENABLED = process.env.QUERY_CACHE_ENABLED !== "0";
const QUERY_CACHE_TTL_MS = Number.parseInt(
  process.env.QUERY_CACHE_TTL_MS ?? "60000",
  10,
);
const QUERY_CACHE_MAX_SIZE = Number.parseInt(
  process.env.QUERY_CACHE_MAX_SIZE ?? "500",
  10,
);

// ============================================================================
// Query Result Cache (L1 - In-Memory)
// ============================================================================

interface CachedQueryResult {
  data: unknown[];
  timestamp: number;
  query: string;
  params: unknown[];
  rowCount: number;
}

const queryCache = new Map<string, CachedQueryResult>();

/**
 * Generates a cache key for a query.
 */
function getQueryCacheKey(query: string, params: unknown[]): string {
  const paramString = JSON.stringify(params);
  const baseStr = query + paramString;
  const encoded = Buffer.from(baseStr).toString("base64").slice(0, 64);
  return "query:" + encoded;
}

/**
 * Gets a cached query result.
 */
function getCachedQuery(
  query: string,
  params: unknown[],
): CachedQueryResult | null {
  if (!QUERY_CACHE_ENABLED) return null;

  const key = getQueryCacheKey(query, params);
  const cached = queryCache.get(key);

  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.timestamp > QUERY_CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[DbOptimized] Query cache hit for:", query.slice(0, 50));
  }

  return cached;
}

/**
 * Caches a query result.
 */
function setCachedQuery(
  query: string,
  params: unknown[],
  data: unknown[],
  rowCount: number,
): void {
  if (!QUERY_CACHE_ENABLED) return;

  const key = getQueryCacheKey(query, params);

  // Enforce max cache size
  if (queryCache.size >= QUERY_CACHE_MAX_SIZE) {
    // Remove oldest entry (first one in iteration)
    const firstKey = queryCache.keys().next().value;
    if (firstKey) {
      queryCache.delete(firstKey);
    }
  }

  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    query,
    params,
    rowCount,
  });
}

/**
 * Clears the query cache.
 */
export function clearQueryCache(): void {
  queryCache.clear();
}

/**
 * Clears query cache entries matching a pattern.
 */
export function invalidateQueryCache(pattern: string): void {
  const regex = new RegExp(pattern);
  let count = 0;

  for (const [key, value] of queryCache.entries()) {
    if (regex.test(value.query)) {
      queryCache.delete(key);
      count++;
    }
  }

  if (process.env.NODE_ENV === "development" && count > 0) {
    console.log("[DbOptimized] Invalidated " + count + " query cache entries");
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
    const cached = getCachedQuery(query, params);
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
    setCachedQuery(query, params, result.rows, result.rowCount ?? 0);
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

      if (process.env.NODE_ENV === "development") {
        console.log(
          "[DbOptimized] Retry attempt " + (attempt + 1) + " for query",
        );
      }
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
    size: number;
    maxSize: number;
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
      enabled: QUERY_CACHE_ENABLED,
      size: queryCache.size,
      maxSize: QUERY_CACHE_MAX_SIZE,
      ttl: QUERY_CACHE_TTL_MS,
    },
    prepared: {
      count: preparedStatements.size,
    },
  };
}
