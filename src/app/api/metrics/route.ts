import "server-only";

import { getEnv } from "../../../lib/env";
import { NextRequest } from "next/server";
import { getPoolMetrics } from "../../../lib/db";
import { getRedisStats } from "../../../lib/redis";
import { getMetrics as getCacheMetrics } from "../../../lib/tieredCache";
import { generatePerformanceReport } from "../../../lib/performance";
import { createStandardHeaders, CACHE_CONTROL } from "../../../lib/apiResponse";
import { rateLimitMetrics, rateLimitResponse } from "../../../lib/rateLimit";
import { getAllCircuitBreakerStats } from "../../../lib/circuitBreaker";

const env = getEnv();
/**
 * Prometheus-compatible Metrics Endpoint
 *
 * Exposes application metrics in Prometheus text format for monitoring.
 *
 * Metrics exported:
 * - Request latency percentiles (p50, p95, p99)
 * - Cache hit rates (L1, L2)
 * - Database connection pool utilization
 * - Circuit breaker states
 * - Memory usage
 *
 * Authentication: Optional via METRICS_TOKEN env var
 */
// ============================================================================
// Types
// ============================================================================

interface PrometheusMetric {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  help: string;
  labels?: Record<string, string>;
  value: number;
}

// ============================================================================
// Metric Collection
// ============================================================================

function collectMetrics(): PrometheusMetric[] {
  const metrics: PrometheusMetric[] = [];
  const now = Date.now();

  // Process metrics
  const memUsage = process.memoryUsage();

  metrics.push({
    name: "nodejs_heap_used_bytes",
    type: "gauge",
    help: "Process heap used in bytes",
    value: memUsage.heapUsed,
  });

  metrics.push({
    name: "nodejs_heap_total_bytes",
    type: "gauge",
    help: "Process heap total in bytes",
    value: memUsage.heapTotal,
  });

  metrics.push({
    name: "nodejs_external_memory_bytes",
    type: "gauge",
    help: "Process external memory in bytes",
    value: memUsage.external,
  });

  metrics.push({
    name: "nodejs_rss_bytes",
    type: "gauge",
    help: "Process resident set size in bytes",
    value: memUsage.rss,
  });

  metrics.push({
    name: "nodejs_uptime_seconds",
    type: "gauge",
    help: "Process uptime in seconds",
    value: Math.floor(process.uptime()),
  });

  // Database pool metrics
  const poolMetrics = getPoolMetrics();
  if (poolMetrics) {
    metrics.push({
      name: "db_pool_total_connections",
      type: "gauge",
      help: "Total number of connections in the pool",
      value: poolMetrics.totalCount,
    });

    metrics.push({
      name: "db_pool_idle_connections",
      type: "gauge",
      help: "Number of idle connections in the pool",
      value: poolMetrics.idleCount,
    });

    metrics.push({
      name: "db_pool_waiting_connections",
      type: "gauge",
      help: "Number of clients waiting for a connection",
      value: poolMetrics.waitingCount,
    });

    metrics.push({
      name: "db_pool_max_connections",
      type: "gauge",
      help: "Maximum number of connections in the pool",
      value: poolMetrics.maxCount,
    });

    // Pool utilization percentage
    const utilization =
      poolMetrics.maxCount > 0
        ? ((poolMetrics.totalCount - poolMetrics.idleCount) /
            poolMetrics.maxCount) *
          100
        : 0;

    metrics.push({
      name: "db_pool_utilization_percent",
      type: "gauge",
      help: "Database connection pool utilization percentage",
      value: Math.round(utilization * 100) / 100,
    });
  }

  // Redis metrics
  const redisStats = getRedisStats();

  metrics.push({
    name: "redis_enabled",
    type: "gauge",
    help: "Whether Redis is enabled (1) or disabled (0)",
    value: redisStats.enabled ? 1 : 0,
  });

  metrics.push({
    name: "redis_pool_size",
    type: "gauge",
    help: "Number of Redis connections in the pool",
    value: redisStats.poolSize,
  });

  metrics.push({
    name: "redis_connected",
    type: "gauge",
    help: "Whether Redis is connected (1) or not (0)",
    value: redisStats.health.connected ? 1 : 0,
  });

  if (redisStats.health.latency !== null) {
    metrics.push({
      name: "redis_latency_ms",
      type: "gauge",
      help: "Redis ping latency in milliseconds",
      value: redisStats.health.latency,
    });
  }

  // Cache metrics
  const cacheMetrics = getCacheMetrics();

  metrics.push({
    name: "cache_l1_entries",
    type: "gauge",
    help: "Number of entries in L1 (memory) cache",
    value: cacheMetrics.l1Entries,
  });

  metrics.push({
    name: "cache_l1_pending",
    type: "gauge",
    help: "Number of pending cache requests (stampede protection)",
    value: cacheMetrics.l1Pending,
  });

  metrics.push({
    name: "cache_l1_hits_total",
    type: "counter",
    help: "Total L1 cache hits",
    value: cacheMetrics.stats.l1Hits,
  });

  metrics.push({
    name: "cache_l1_misses_total",
    type: "counter",
    help: "Total L1 cache misses",
    value: cacheMetrics.stats.l1Misses,
  });

  metrics.push({
    name: "cache_l2_hits_total",
    type: "counter",
    help: "Total L2 cache hits",
    value: cacheMetrics.stats.l2Hits,
  });

  metrics.push({
    name: "cache_l2_misses_total",
    type: "counter",
    help: "Total L2 cache misses",
    value: cacheMetrics.stats.l2Misses,
  });

  metrics.push({
    name: "cache_hit_rate",
    type: "gauge",
    help: "Overall cache hit rate (0-1)",
    value: Math.round(cacheMetrics.stats.hitRate * 10000) / 10000,
  });

  metrics.push({
    name: "cache_requests_total",
    type: "counter",
    help: "Total cache requests",
    value: cacheMetrics.stats.totalRequests,
  });

  metrics.push({
    name: "cache_stampede_preventions_total",
    type: "counter",
    help: "Total stampede prevention events",
    value: cacheMetrics.stats.stampedePreventions,
  });

  // Performance metrics
  const perfReport = generatePerformanceReport();

  metrics.push({
    name: "http_requests_total",
    type: "counter",
    help: "Total HTTP requests processed",
    value: perfReport.aggregate.requestCount,
  });

  metrics.push({
    name: "http_request_duration_avg_ms",
    type: "gauge",
    help: "Average request duration in milliseconds",
    value: Math.round(perfReport.aggregate.averageLatency * 100) / 100,
  });

  metrics.push({
    name: "http_request_duration_p95_ms",
    type: "gauge",
    help: "95th percentile request duration in milliseconds",
    value: Math.round(perfReport.aggregate.p95Latency * 100) / 100,
  });

  metrics.push({
    name: "http_request_duration_p99_ms",
    type: "gauge",
    help: "99th percentile request duration in milliseconds",
    value: Math.round(perfReport.aggregate.p99Latency * 100) / 100,
  });

  metrics.push({
    name: "http_error_rate",
    type: "gauge",
    help: "HTTP error rate (0-1)",
    value: Math.round(perfReport.aggregate.errorRate * 10000) / 10000,
  });

  metrics.push({
    name: "http_cache_hit_rate",
    type: "gauge",
    help: "HTTP response cache hit rate (0-1)",
    value: Math.round(perfReport.aggregate.cacheHitRate * 10000) / 10000,
  });

  // Per-endpoint metrics
  for (const [endpoint, endpointMetrics] of Object.entries(
    perfReport.endpoints,
  )) {
    const safeEndpoint = endpoint.replace(/[^a-zA-Z0-9_]/g, "_");

    metrics.push({
      name: "http_endpoint_requests_total",
      type: "counter",
      help: "Total requests per endpoint",
      labels: { endpoint: safeEndpoint },
      value: endpointMetrics.requestCount,
    });

    metrics.push({
      name: "http_endpoint_duration_avg_ms",
      type: "gauge",
      help: "Average request duration per endpoint",
      labels: { endpoint: safeEndpoint },
      value: Math.round(endpointMetrics.averageLatency * 100) / 100,
    });

    metrics.push({
      name: "http_endpoint_duration_p95_ms",
      type: "gauge",
      help: "95th percentile duration per endpoint",
      labels: { endpoint: safeEndpoint },
      value: Math.round(endpointMetrics.p95Latency * 100) / 100,
    });
  }

  // Circuit breaker status
  const circuitBreakerStats = getAllCircuitBreakerStats();
  for (const [name, stats] of Object.entries(circuitBreakerStats)) {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_");

    // State: 0=closed (healthy), 1=half-open, 2=open (unhealthy)
    const stateValue =
      stats.state === "closed" ? 0 : stats.state === "half-open" ? 1 : 2;

    metrics.push({
      name: "circuit_breaker_state",
      type: "gauge",
      help: "Circuit breaker state: 0=closed (healthy), 1=half-open, 2=open (unhealthy)",
      labels: { service: safeName },
      value: stateValue,
    });

    metrics.push({
      name: "circuit_breaker_failure_count",
      type: "counter",
      help: "Total circuit breaker failures",
      labels: { service: safeName },
      value: stats.failureCount,
    });

    metrics.push({
      name: "circuit_breaker_success_count",
      type: "counter",
      help: "Total circuit breaker successes",
      labels: { service: safeName },
      value: stats.successCount,
    });
  }

  metrics.push({
    name: "metrics_timestamp_ms",
    type: "gauge",
    help: "Timestamp when metrics were collected",
    value: now,
  });

  return metrics;
}

// ============================================================================
// Prometheus Format Output
// ============================================================================

function formatPrometheusMetrics(metrics: PrometheusMetric[]): string {
  const lines: string[] = [];

  for (const metric of metrics) {
    // Add HELP and TYPE comments
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);

    // Format metric line with optional labels
    if (metric.labels && Object.keys(metric.labels).length > 0) {
      const labelStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${metric.name}{${labelStr}} ${metric.value}`);
    } else {
      lines.push(`${metric.name} ${metric.value}`);
    }

    lines.push(""); // Empty line between metrics
  }

  return lines.join("\n");
}

// ============================================================================
// Request Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const { result: rlResult, headers: rlHeaders } =
    await rateLimitMetrics(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  // Optional authentication via token
  const metricsToken = env.METRICS_TOKEN;
  if (metricsToken) {
    const authHeader = request.headers.get("authorization");
    const providedToken = authHeader?.replace("Bearer ", "");

    if (providedToken !== metricsToken) {
      return new Response("Unauthorized", {
        status: 401,
        headers: rlHeaders as unknown as HeadersInit,
      });
    }
  }

  const metrics = collectMetrics();
  const output = formatPrometheusMetrics(metrics);

  const headers = createStandardHeaders({
    cacheControl: CACHE_CONTROL.NO_STORE,
    additionalHeaders: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });

  return new Response(output, {
    status: 200,
    headers: {
      ...(headers as HeadersInit),
      ...(rlHeaders as unknown as HeadersInit),
    },
  });
}
