/**
 * Enhanced Health Check Endpoint
 *
 * Provides comprehensive health status including database, Redis,
 * VectorEngine availability, system metrics, and degradation states.
 *
 * Returns:
 * - 200: Healthy (all critical systems operational)
 * - 503: Degraded (non-critical systems down)
 * - 503: Unhealthy (critical systems down)
 */

import "server-only";

import { getDbPool } from "@/lib/db";
import { getRedis, getRedisStats } from "@/lib/redis";
import { getVectorEngineChatUrl } from "@/lib/vectorengine";
import { featureFlags } from "@/lib/env";
import {
  createStandardHeaders,
  CACHE_CONTROL,
  generateRequestId,
} from "@/lib/apiResponse";
import { getMetrics } from "@/lib/tieredCache";
import { generatePerformanceReport } from "@/lib/performance";

/* -------------------------------------------------------------------------------------------------
 * Health Check Types
 * ------------------------------------------------------------------------------------------------- */

/**
 * Overall health status.
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Individual component status.
 */
export type ComponentStatus = "healthy" | "degraded" | "unhealthy" | "disabled";

/**
 * Health check result for a component.
 */
export interface ComponentHealth {
  status: ComponentStatus;
  latency?: number; // milliseconds
  error?: string;
  details?: {
    [key: string]: string | number | boolean | null;
  };
}

/**
 * System metrics.
 */
export interface SystemMetrics {
  memoryUsedMb: number;
  memoryAvailableMb: number;
  memoryPercent: number;
  cpuUsagePercent?: number;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  arch: string;
}

/**
 * Cache health metrics.
 */
export interface CacheHealth {
  l1: {
    size: number;
    pending: number;
  };
  l2: {
    enabled: boolean;
    poolSize: number;
  };
  stats: {
    hitRate: number;
    totalRequests: number;
  };
}

/**
 * Full health check response.
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  version?: string;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    vectorEngine: ComponentHealth;
  };
  metrics: SystemMetrics;
  checks: {
    count: number;
    failed: number;
    passed: number;
    skipped: number;
  };
  performance?: {
    cache: CacheHealth;
    aggregate: {
      requestCount: number;
      averageLatency: number;
      p95Latency: number;
      errorRate: number;
    };
  };
}

/* -------------------------------------------------------------------------------------------------
 * Component Health Checks
 * ------------------------------------------------------------------------------------------------- */

/**
 * Checks database health with latency measurement.
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  if (!featureFlags.databaseEnabled) {
    return {
      status: "disabled",
      details: { reason: "DATABASE_URL not configured" },
    };
  }

  const db = getDbPool();
  if (!db) {
    return {
      status: "unhealthy",
      error: "Database pool not initialized",
    };
  }

  const startTime = performance.now();

  try {
    // Simple health check query
    const result = await db.query<{ now: string }>("SELECT NOW() as now");

    const latency = Math.round(performance.now() - startTime);

    // Check latency thresholds
    let status: ComponentStatus = "healthy";
    if (latency > 1000) {
      status = "degraded";
    }

    return {
      status,
      latency,
      details: {
        currentTime: result.rows[0]?.now ?? null,
        poolTotalCount: db.totalCount,
        poolIdleCount: db.idleCount,
        poolWaitingCount: db.waitingCount,
      },
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      status: "unhealthy",
      latency,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Checks Redis health with latency measurement.
 */
async function checkRedisHealth(): Promise<ComponentHealth> {
  if (!featureFlags.redisEnabled) {
    return {
      status: "disabled",
      details: { reason: "REDIS_URL not configured" },
    };
  }

  const redis = getRedis();
  if (!redis) {
    return {
      status: "unhealthy",
      error: "Redis client not initialized",
    };
  }

  const startTime = performance.now();

  try {
    // Ping Redis
    await redis.connect();
    const result = await redis.ping();

    const latency = Math.round(performance.now() - startTime);

    if (result !== "PONG") {
      return {
        status: "unhealthy",
        latency,
        error: `Unexpected PING response: ${result}`,
      };
    }

    // Check latency thresholds
    let status: ComponentStatus = "healthy";
    if (latency > 500) {
      status = "degraded";
    }

    // Get additional info if available
    const info = await redis.info("server").catch(() => null);

    return {
      status,
      latency,
      details: info
        ? {
            version: info.match(/redis_version:([^\r\n]+)/)?.[1] ?? "unknown",
            mode: info.match(/redis_mode:([^\r\n]+)/)?.[1] ?? "unknown",
          }
        : undefined,
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      status: "unhealthy",
      latency,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Checks VectorEngine availability with latency measurement.
 */
async function checkVectorEngineHealth(): Promise<ComponentHealth> {
  if (!featureFlags.vectorEngineEnabled) {
    return {
      status: "disabled",
      details: { reason: "VECTORENGINE_API_KEY not configured" },
    };
  }

  const url = getVectorEngineChatUrl();
  if (!url) {
    return {
      status: "unhealthy",
      error: "VectorEngine URL not configured",
    };
  }

  const startTime = performance.now();

  try {
    // Make a minimal chat completion request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VECTORENGINE_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model: process.env.VECTORENGINE_MODEL ?? "grok-4-fast-non-reasoning",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const latency = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        status: "unhealthy",
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Check latency thresholds
    let status: ComponentStatus = "healthy";
    if (latency > 3000) {
      status = "degraded";
    } else if (latency > 1500) {
      status = "degraded";
    }

    return {
      status,
      latency,
      details: {
        model: process.env.VECTORENGINE_MODEL ?? "grok-4-fast-non-reasoning",
        baseUrl:
          process.env.VECTORENGINE_BASE_URL ?? "https://api.vectorengine.ai",
      },
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle timeout specially
    if (errorMessage.includes("abort") || errorMessage.includes("timeout")) {
      return {
        status: "unhealthy",
        latency,
        error: "Request timeout",
      };
    }

    return {
      status: "unhealthy",
      latency,
      error: errorMessage,
    };
  }
}

/* -------------------------------------------------------------------------------------------------
 * System Metrics Collection
 * ------------------------------------------------------------------------------------------------- */

/**
 * Collects system metrics for the health check.
 */
function collectSystemMetrics(): SystemMetrics {
  // Memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryAvailableMb = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercent = Math.round(
    (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
  );

  // Uptime
  const uptimeSeconds = Math.round(process.uptime());

  // Node and system info
  const nodeVersion = process.version;
  const platform = process.platform;
  const arch = process.arch;

  return {
    memoryUsedMb,
    memoryAvailableMb,
    memoryPercent,
    uptimeSeconds,
    nodeVersion,
    platform,
    arch,
  };
}

/* -------------------------------------------------------------------------------------------------
 * Health Status Aggregation
 * ------------------------------------------------------------------------------------------------- */

/**
 * Determines overall health status from component statuses.
 */
function calculateOverallStatus(components: {
  database: ComponentHealth;
  redis: ComponentHealth;
  vectorEngine: ComponentHealth;
}): HealthStatus {
  const { database, redis, vectorEngine } = components;

  let unhealthyCount = 0;
  let degradedCount = 0;

  // Check database (critical for this app)
  if (database.status === "unhealthy") {
    unhealthyCount++;
  } else if (database.status === "degraded") {
    degradedCount++;
  }

  // Check Redis (non-critical - can fall back to in-memory)
  if (redis.status === "unhealthy") {
    // Redis failure alone doesn't make app unhealthy
  } else if (redis.status === "degraded") {
    degradedCount++;
  }

  // Check VectorEngine (important but not critical - has fallback)
  if (vectorEngine.status === "unhealthy") {
    // VectorEngine failure alone doesn't make app unhealthy
  } else if (vectorEngine.status === "degraded") {
    degradedCount++;
  }

  // Determine overall status
  if (unhealthyCount > 0) {
    return "unhealthy";
  }

  if (degradedCount > 0) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Counts check results for summary.
 */
function summarizeChecks(components: {
  database: ComponentHealth;
  redis: ComponentHealth;
  vectorEngine: ComponentHealth;
}): { count: number; passed: number; failed: number; skipped: number } {
  const allComponents = Object.values(components);

  return {
    count: allComponents.length,
    passed: allComponents.filter((c) => c.status === "healthy").length,
    failed: allComponents.filter((c) => c.status === "unhealthy").length,
    skipped: allComponents.filter((c) => c.status === "disabled").length,
  };
}

/* -------------------------------------------------------------------------------------------------
 * GET Handler
 * ------------------------------------------------------------------------------------------------- */

export async function GET() {
  const requestId = generateRequestId();
  const startTime = performance.now();

  // Run all health checks in parallel
  const [database, redis, vectorEngine] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkVectorEngineHealth(),
  ]);

  const components = { database, redis, vectorEngine };
  const metrics = collectSystemMetrics();
  const status = calculateOverallStatus(components);
  const checks = summarizeChecks(components);
  const totalLatency = Math.round(performance.now() - startTime);

  // Gather cache and performance metrics
  const cacheMetrics = getMetrics();
  const redisStats = getRedisStats();
  const perfReport = generatePerformanceReport();

  // Determine HTTP status code
  const httpStatus = status === "healthy" ? 200 : 503;

  // Build response body
  const body: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    version:
      process.env.npm_package_version ?? process.env.APP_VERSION ?? "0.1.0",
    components,
    metrics,
    checks,
    performance: {
      cache: {
        l1: {
          size: cacheMetrics.l1Entries,
          pending: cacheMetrics.l1Pending,
        },
        l2: {
          enabled: redisStats.enabled,
          poolSize: redisStats.poolSize,
        },
        stats: {
          hitRate: cacheMetrics.stats.hitRate,
          totalRequests: cacheMetrics.stats.totalRequests,
        },
      },
      aggregate: {
        requestCount: perfReport.aggregate.requestCount,
        averageLatency: Math.round(perfReport.aggregate.averageLatency),
        p95Latency: Math.round(perfReport.aggregate.p95Latency),
        errorRate: perfReport.aggregate.errorRate,
      },
    },
  };

  // Create headers
  const headers = createStandardHeaders({
    requestId,
    cacheControl: CACHE_CONTROL.NO_STORE,
    additionalHeaders: {
      "X-Health-Check-Duration": totalLatency + "ms",
      "X-Health-Status": status,
    },
  });

  return Response.json(body, {
    status: httpStatus,
    headers,
  });
}

/* -------------------------------------------------------------------------------------------------
 * HEAD Handler (for simple liveness checks)
 * ------------------------------------------------------------------------------------------------- */

export async function HEAD() {
  // Quick liveness check - just check if the process is running
  const headers = createStandardHeaders({
    cacheControl: CACHE_CONTROL.NO_STORE,
  });

  return new Response(null, {
    status: 200,
    headers,
  });
}
