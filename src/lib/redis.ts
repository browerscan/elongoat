import "server-only";

import Redis from "ioredis";
export type { Redis } from "ioredis";

// ============================================================================
// Configuration
// ============================================================================

const REDIS_ENABLED = process.env.REDIS_URL !== undefined;
const REDIS_MAX_RETRIES = Number.parseInt(
  process.env.REDIS_MAX_RETRIES ?? "3",
  10,
);
const REDIS_RETRY_DELAY_MS = Number.parseInt(
  process.env.REDIS_RETRY_DELAY_MS ?? "100",
  10,
);
const REDIS_CONNECT_TIMEOUT_MS = Number.parseInt(
  process.env.REDIS_CONNECT_TIMEOUT_MS ?? "5000",
  10,
);
// Reserved for future command-level timeout implementation
// const REDIS_COMMAND_TIMEOUT_MS = Number.parseInt(
//   process.env.REDIS_COMMAND_TIMEOUT_MS ?? "3000",
//   10,
// );
const REDIS_KEEP_ALIVE_MS = Number.parseInt(
  process.env.REDIS_KEEP_ALIVE_MS ?? "30000",
  10,
);

// ============================================================================
// Redis Client Singleton with Connection Pooling
// ============================================================================

let redisClient: Redis | null = null;
let redisPool: Redis[] | null = null;
const MAX_POOL_SIZE = Number.parseInt(process.env.REDIS_POOL_SIZE ?? "5", 10);
let poolIndex = 0;

interface RedisHealthStatus {
  connected: boolean;
  latency: number | null;
  error: string | null;
  lastCheck: string;
}

let redisHealth: RedisHealthStatus = {
  connected: false,
  latency: null,
  error: null,
  lastCheck: new Date().toISOString(),
};

/**
 * Creates a new Redis instance with optimized configuration.
 */
function createRedisInstance(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not defined");
  }

  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: REDIS_MAX_RETRIES,
    enableReadyCheck: true,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    keepAlive: REDIS_KEEP_ALIVE_MS,
    retryStrategy: (times) => {
      if (times > REDIS_MAX_RETRIES) {
        return null;
      }
      return Math.min(times * REDIS_RETRY_DELAY_MS, 1000);
    },
    // Enable offline queue for better resilience
    enableOfflineQueue: true,
    // Reconnect automatically
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    // Connection name for monitoring
    connectionName: `elongoat-${process.pid}-${Date.now()}`,
  });
}

/**
 * Gets or creates the primary Redis client instance.
 */
export function getRedis(): Redis | null {
  if (!REDIS_ENABLED) return null;

  if (redisClient && redisClient.status === "ready") {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createRedisInstance();
  }

  return redisClient;
}

/**
 * Gets a Redis client from the connection pool for load distribution.
 * Uses round-robin distribution across the pool.
 */
export function getRedisFromPool(): Redis | null {
  if (!REDIS_ENABLED) return null;

  const primary = getRedis();
  if (!primary) return null;

  // Initialize pool if needed
  if (!redisPool) {
    redisPool = [primary];
    for (let i = 1; i < MAX_POOL_SIZE; i++) {
      const client = createRedisInstance();
      // Pre-connect pool members
      client.connect().catch(() => {
        // Connection will be established on first use
      });
      redisPool.push(client);
    }
  }

  // Round-robin selection
  const client = redisPool[poolIndex % redisPool.length];
  poolIndex = (poolIndex + 1) % redisPool.length;

  return client;
}

/**
 * Gets the primary Redis client (for backwards compatibility).
 */
export function getRedisPrimary(): Redis | null {
  return getRedis();
}

// ============================================================================
// Pipeline Support for Batch Operations
// ============================================================================

/**
 * Creates a Redis pipeline for batched operations.
 * Pipelines reduce network round-trips by queuing multiple commands.
 */
export function createPipeline(): ReturnType<Redis["pipeline"]> | null {
  const redis = getRedisFromPool();
  if (!redis) return null;

  try {
    return redis.pipeline();
  } catch {
    return null;
  }
}

/**
 * Executes a pipeline with error handling.
 */
export async function executePipeline(
  pipeline: { exec: () => Promise<unknown[]> } | null,
): Promise<unknown[] | null> {
  if (!pipeline) return null;

  try {
    return await pipeline.exec();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Redis] Pipeline error:", error);
    }
    return null;
  }
}

// ============================================================================
// Multi/Batch Operation Helpers
// ============================================================================

/**
 * Batch get multiple keys at once using MGET.
 */
export async function mget(keys: string[]): Promise<(string | null)[] | null> {
  if (keys.length === 0) return [];
  if (keys.length === 1) {
    const redis = getRedis();
    if (!redis) return null;
    try {
      await redis.connect();
      const val = await redis.get(keys[0]);
      return [val];
    } catch {
      return null;
    }
  }

  const redis = getRedis();
  if (!redis) return null;

  try {
    await redis.connect();
    return await redis.mget(...keys);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Redis] MGET error:", error);
    }
    return null;
  }
}

/**
 * Batch set multiple key-value pairs at once using MSET.
 */
export async function mset(
  keyValuePairs: Record<string, string>,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.connect();
    await redis.mset(keyValuePairs);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Redis] MSET error:", error);
    }
    return false;
  }
}

/**
 * Batch delete multiple keys at once.
 */
export async function mdel(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  if (keys.length === 1) {
    const redis = getRedis();
    if (!redis) return 0;
    try {
      await redis.connect();
      return (await redis.del(keys[0])) ?? 0;
    } catch {
      return 0;
    }
  }

  const redis = getRedis();
  if (!redis) return 0;

  try {
    await redis.connect();
    return await redis.del(...keys);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Redis] DEL error:", error);
    }
    return 0;
  }
}

// ============================================================================
// Health Check Integration
// ============================================================================

/**
 * Performs a health check on Redis with latency measurement.
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const startTime = performance.now();
  const redis = getRedis();

  if (!redis) {
    redisHealth = {
      connected: false,
      latency: null,
      error: "Redis client not initialized (REDIS_URL not set)",
      lastCheck: new Date().toISOString(),
    };
    return redisHealth;
  }

  try {
    await redis.connect();
    const result = await redis.ping();
    const latency = Math.round(performance.now() - startTime);

    redisHealth = {
      connected: result === "PONG",
      latency,
      error: result !== "PONG" ? "Unexpected PING response" : null,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    redisHealth = {
      connected: false,
      latency,
      error: error instanceof Error ? error.message : String(error),
      lastCheck: new Date().toISOString(),
    };
  }

  return redisHealth;
}

/**
 * Gets the current cached Redis health status.
 */
export function getRedisHealthStatus(): RedisHealthStatus {
  return redisHealth;
}

/**
 * Checks if Redis is currently healthy and connected.
 */
export function isRedisHealthy(): boolean {
  return redisHealth.connected && redisHealth.error === null;
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Gracefully closes all Redis connections.
 */
export async function closeRedis(): Promise<void> {
  const closePromises: Promise<unknown>[] = [];

  if (redisClient) {
    closePromises.push(
      redisClient.quit().catch((err) => {
        console.error("[Redis] Error closing primary connection:", err);
      }),
    );
  }

  if (redisPool) {
    for (const client of redisPool) {
      if (client !== redisClient) {
        closePromises.push(
          client.quit().catch((err) => {
            console.error("[Redis] Error closing pool connection:", err);
          }),
        );
      }
    }
    redisPool = null;
  }

  await Promise.all(closePromises);
  redisClient = null;
}

/**
 * Resets the Redis client singleton (useful for testing or reconnection).
 */
export function resetRedisClient(): void {
  void closeRedis();
  redisHealth = {
    connected: false,
    latency: null,
    error: null,
    lastCheck: new Date().toISOString(),
  };
}

// ============================================================================
// Statistics
// ============================================================================

interface RedisStats {
  enabled: boolean;
  poolSize: number;
  health: RedisHealthStatus;
}

/**
 * Gets Redis statistics for monitoring.
 */
export function getRedisStats(): RedisStats {
  return {
    enabled: REDIS_ENABLED,
    poolSize: redisPool?.length ?? 0,
    health: redisHealth,
  };
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

// Ensure Redis connections close on process exit
if (typeof process !== "undefined") {
  process.on("beforeexit", () => {
    void closeRedis();
  });

  process.on("SIGINT", () => {
    void closeRedis();
  });

  process.on("SIGTERM", () => {
    void closeRedis();
  });
}
