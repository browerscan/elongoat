// Server-only module (import removed for backend compatibility)
import Redis from "ioredis";
export type { Redis } from "ioredis";
import { getEnv } from "./env";

const env = getEnv();

// ============================================================================
// Configuration
// ============================================================================

/**
 * Check if Redis is enabled (REDIS_URL is set).
 */
export function isRedisEnabled(): boolean {
  return !!env.REDIS_URL;
}
const REDIS_MAX_RETRIES = env.REDIS_MAX_RETRIES;
const REDIS_RETRY_DELAY_MS = env.REDIS_RETRY_DELAY_MS;
const REDIS_CONNECT_TIMEOUT_MS = env.REDIS_CONNECT_TIMEOUT_MS;
// Reserved for future command-level timeout implementation
// const REDIS_COMMAND_TIMEOUT_MS = Number.parseInt(
//   env.REDIS_COMMAND_TIMEOUT_MS ?? "3000",
//   10,
// );
const REDIS_KEEP_ALIVE_MS = env.REDIS_KEEP_ALIVE_MS;

// ============================================================================
// Redis Client Singleton with Connection Pooling
// ============================================================================

let redisClient: Redis | null = null;
let redisPool: Redis[] | null = null;
const MAX_POOL_SIZE = env.REDIS_POOL_SIZE;
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
  const url = env.REDIS_URL;
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
 * Ensures the Redis client is connected before use.
 * Idempotent - safe to call multiple times.
 */
async function ensureRedisConnected(redis: Redis): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    return;
  }
  if (redis.status === "end") {
    // Client was closed, recreate it
    if (redis === redisClient) {
      redisClient = null;
    }
    throw new Error("Redis client was closed, cannot reconnect");
  }
  // For "connect" status, wait for ready
  await redis.connect();
}

/**
 * Gets or creates the primary Redis client instance.
 */
export function getRedis(): Redis | null {
  if (!isRedisEnabled()) return null;

  if (!redisClient) {
    redisClient = createRedisInstance();
  }

  return redisClient;
}

/**
 * Gets a Redis client from the connection pool for load distribution.
 * Uses round-robin distribution across the pool.
 * Connection is established lazily on first use.
 */
export function getRedisFromPool(): Redis | null {
  if (!isRedisEnabled()) return null;

  const primary = getRedis();
  if (!primary) return null;

  // Initialize pool if needed (lazy initialization)
  if (!redisPool) {
    redisPool = [primary];
    for (let i = 1; i < MAX_POOL_SIZE; i++) {
      redisPool.push(createRedisInstance());
    }
  }

  // Round-robin selection
  const client = redisPool[poolIndex % redisPool.length];
  poolIndex = (poolIndex + 1) % redisPool.length;

  return client;
}

/**
 * Gets a Redis client from the pool and ensures it's connected.
 * Use this when you need a connected client for operations.
 */
export async function getConnectedRedisFromPool(): Promise<Redis | null> {
  const redis = getRedisFromPool();
  if (!redis) return null;
  await ensureRedisConnected(redis);
  return redis;
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
 * The client will be connected automatically when the pipeline is executed.
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
 * Executes a pipeline with error handling and ensures connection.
 */
export async function executePipeline(
  pipeline: { exec: () => Promise<unknown[]> } | null,
): Promise<unknown[] | null> {
  if (!pipeline) return null;

  try {
    return await pipeline.exec();
  } catch (error) {
    if (env.NODE_ENV === "development") {
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

  const redis = getRedis();
  if (!redis) return null;

  try {
    await ensureRedisConnected(redis);
    return await redis.mget(...keys);
  } catch (error) {
    if (env.NODE_ENV === "development") {
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
    await ensureRedisConnected(redis);
    await redis.mset(keyValuePairs);
    return true;
  } catch (error) {
    if (env.NODE_ENV === "development") {
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

  const redis = getRedis();
  if (!redis) return 0;

  try {
    await ensureRedisConnected(redis);
    return await redis.del(...keys);
  } catch (error) {
    if (env.NODE_ENV === "development") {
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
    await ensureRedisConnected(redis);
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
    enabled: isRedisEnabled(),
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
