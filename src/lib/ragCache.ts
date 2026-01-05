import "server-only";

import { getRedis, isRedisEnabled } from "./redis";
import type { RagSearchResponse } from "./ragSearch";
import type { HybridSearchResponse } from "./ragHybridSearch";
import { getEnv } from "./env";

const env = getEnv();
/**
 * RAG Search Cache Layer
 *
 * Provides Redis-based caching for RAG search results to reduce database load
 * and improve response times.
 *
 * Cache keys are based on query + options hash.
 * TTL is configurable (default: 1 hour).
 */
// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  ttlSeconds: number;
  enabled: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_PREFIX = "rag:cache:";
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const STATS_KEY = "rag:cache:stats";

// In-memory cache for ultra-fast repeated queries
const memoryCache = new Map<string, { data: string; expiresAt: number }>();
const MEMORY_CACHE_TTL_MS = 60000; // 1 minute
const MAX_MEMORY_CACHE_SIZE = 100;

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate a cache key from search options
 */
export function generateCacheKey(
  type: "search" | "hybrid",
  query: string,
  sources: string[],
  limit: number,
  options?: { fullTextWeight?: number; semanticWeight?: number },
): string {
  const normalizedQuery = query.toLowerCase().trim();
  const sortedSources = [...sources].sort().join(",");

  let optionsHash = "";
  if (options) {
    optionsHash = `:ft${options.fullTextWeight || 0.5}:sm${options.semanticWeight || 0.5}`;
  }

  // Simple hash for the key
  const keyData = `${type}:${normalizedQuery}:${sortedSources}:${limit}${optionsHash}`;
  const hash = simpleHash(keyData);

  return `${CACHE_PREFIX}${type}:${hash}`;
}

/**
 * Simple string hash function (djb2)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Memory Cache (L1)
// ============================================================================

/**
 * Get from memory cache
 */
function getFromMemoryCache(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set in memory cache
 */
function setInMemoryCache(key: string, data: string): void {
  // Evict oldest entries if cache is full
  if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }

  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
}

// ============================================================================
// Redis Cache (L2)
// ============================================================================

/**
 * Get cached search result
 */
export async function getCachedSearchResult<
  T extends RagSearchResponse | HybridSearchResponse,
>(key: string): Promise<T | null> {
  // Try memory cache first
  const memoryResult = getFromMemoryCache(key);
  if (memoryResult) {
    try {
      const parsed = JSON.parse(memoryResult) as T;
      await incrementCacheStats("hits");
      return parsed;
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Try Redis
  if (!isRedisEnabled()) {
    await incrementCacheStats("misses");
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    await incrementCacheStats("misses");
    return null;
  }

  try {
    await redis.connect();
    const cached = await redis.get(key);

    if (!cached) {
      await incrementCacheStats("misses");
      return null;
    }

    const parsed = JSON.parse(cached) as T;

    // Store in memory cache for faster subsequent access
    setInMemoryCache(key, cached);

    await incrementCacheStats("hits");
    return parsed;
  } catch (error) {
    console.error("[RAG Cache] Error getting cached result:", error);
    await incrementCacheStats("misses");
    return null;
  }
}

/**
 * Cache a search result
 */
export async function cacheSearchResult<
  T extends RagSearchResponse | HybridSearchResponse,
>(
  key: string,
  result: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const serialized = JSON.stringify(result);

  // Always store in memory cache
  setInMemoryCache(key, serialized);

  // Store in Redis if available
  if (!isRedisEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.connect();
    await redis.set(key, serialized, "EX", ttlSeconds);
  } catch (error) {
    console.error("[RAG Cache] Error caching result:", error);
  }
}

/**
 * Invalidate cache for a specific query pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  // Clear memory cache
  const keysToDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => memoryCache.delete(key));

  // Clear Redis cache
  if (!isRedisEnabled()) return keysToDelete.length;

  const redis = getRedis();
  if (!redis) return keysToDelete.length;

  try {
    await redis.connect();
    const keys = await redis.keys(`${CACHE_PREFIX}*${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length + keysToDelete.length;
  } catch (error) {
    console.error("[RAG Cache] Error invalidating cache:", error);
    return keysToDelete.length;
  }
}

/**
 * Clear all RAG cache
 */
export async function clearAllCache(): Promise<number> {
  // Clear memory cache
  const memoryCacheSize = memoryCache.size;
  memoryCache.clear();

  // Clear Redis cache
  if (!isRedisEnabled()) return memoryCacheSize;

  const redis = getRedis();
  if (!redis) return memoryCacheSize;

  try {
    await redis.connect();
    const keys = await redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length + memoryCacheSize;
  } catch (error) {
    console.error("[RAG Cache] Error clearing cache:", error);
    return memoryCacheSize;
  }
}

// ============================================================================
// Cache Statistics
// ============================================================================

let localStats = { hits: 0, misses: 0 };

/**
 * Increment cache statistics
 */
async function incrementCacheStats(type: "hits" | "misses"): Promise<void> {
  localStats[type]++;

  if (!isRedisEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.connect();
    await redis.hincrby(STATS_KEY, type, 1);
  } catch {
    // Ignore stats errors
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  let hits = localStats.hits;
  let misses = localStats.misses;

  if (isRedisEnabled()) {
    const redis = getRedis();
    if (redis) {
      try {
        await redis.connect();
        const stats = await redis.hgetall(STATS_KEY);
        hits += parseInt(stats.hits || "0", 10);
        misses += parseInt(stats.misses || "0", 10);
      } catch {
        // Use local stats
      }
    }
  }

  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;

  return {
    hits,
    misses,
    hitRate: Math.round(hitRate * 100) / 100,
  };
}

/**
 * Reset cache statistics
 */
export async function resetCacheStats(): Promise<void> {
  localStats = { hits: 0, misses: 0 };

  if (!isRedisEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.connect();
    await redis.del(STATS_KEY);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Get cache configuration from environment
 */
export function getCacheConfig(): CacheConfig {
  return {
    ttlSeconds: env.RAG_CACHE_TTL_SECONDS || DEFAULT_TTL_SECONDS,
    enabled: env.RAG_CACHE_ENABLED,
  };
}

/**
 * Check if caching is enabled
 */
export function isCachingEnabled(): boolean {
  return getCacheConfig().enabled && isRedisEnabled();
}
