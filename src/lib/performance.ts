import "server-only";

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
  requestCount: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  cacheHitRate: number;
  timestamp: string;
}

export interface MetricRecord {
  timestamp: number;
  latency: number;
  success: boolean;
  cacheHit: boolean;
  endpoint: string;
}

// ============================================================================
// Metrics Storage
// ============================================================================

const metrics = new Map<string, MetricRecord[]>();
const MAX_METRICS_PER_ENDPOINT = 1000;
const MAX_AGE_MS = 300000; // 5 minutes

// ============================================================================
// Metrics Collection
// ============================================================================

/**
 * Records a performance metric.
 */
export function recordMetric(
  endpoint: string,
  latency: number,
  success: boolean,
  cacheHit: boolean,
): void {
  let endpointMetrics = metrics.get(endpoint);

  if (!endpointMetrics) {
    endpointMetrics = [];
    metrics.set(endpoint, endpointMetrics);
  }

  // Add new metric
  endpointMetrics.push({
    timestamp: Date.now(),
    latency,
    success,
    cacheHit,
    endpoint,
  });

  // Clean up old metrics
  const now = Date.now();
  const cutoff = now - MAX_AGE_MS;

  // Remove old metrics
  let i = 0;
  while (i < endpointMetrics.length && endpointMetrics[i].timestamp < cutoff) {
    i++;
  }
  if (i > 0) {
    endpointMetrics.splice(0, i);
  }

  // Enforce max size
  if (endpointMetrics.length > MAX_METRICS_PER_ENDPOINT) {
    endpointMetrics.splice(
      0,
      endpointMetrics.length - MAX_METRICS_PER_ENDPOINT,
    );
  }
}

/**
 * Calculates percentile from an array of numbers.
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * Gets performance metrics for an endpoint.
 */
export function getMetrics(endpoint: string): PerformanceMetrics | null {
  const endpointMetrics = metrics.get(endpoint);

  if (!endpointMetrics || endpointMetrics.length === 0) {
    return null;
  }

  const latencies = endpointMetrics.map((m) => m.latency);
  const successCount = endpointMetrics.filter((m) => m.success).length;
  const cacheHitCount = endpointMetrics.filter((m) => m.cacheHit).length;

  return {
    requestCount: endpointMetrics.length,
    averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    errorRate: (endpointMetrics.length - successCount) / endpointMetrics.length,
    cacheHitRate: cacheHitCount / endpointMetrics.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gets aggregate metrics across all endpoints.
 */
export function getAggregateMetrics(): PerformanceMetrics {
  const allMetrics: MetricRecord[] = [];

  for (const endpointMetrics of metrics.values()) {
    allMetrics.push(...endpointMetrics);
  }

  if (allMetrics.length === 0) {
    return {
      requestCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: 0,
      cacheHitRate: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const latencies = allMetrics.map((m) => m.latency);
  const successCount = allMetrics.filter((m) => m.success).length;
  const cacheHitCount = allMetrics.filter((m) => m.cacheHit).length;

  return {
    requestCount: allMetrics.length,
    averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    errorRate: (allMetrics.length - successCount) / allMetrics.length,
    cacheHitRate: cacheHitCount / allMetrics.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clears metrics for an endpoint or all endpoints.
 */
export function clearMetrics(endpoint?: string): void {
  if (endpoint) {
    metrics.delete(endpoint);
  } else {
    metrics.clear();
  }
}

// ============================================================================
// Decorator for automatic metric collection
// ============================================================================

/**
 * Wraps a handler to automatically collect performance metrics.
 */
export function withPerformanceTracking<
  T extends (...args: never[]) => Promise<unknown>,
>(endpoint: string, handler: T): T {
  return (async (...args: unknown[]) => {
    const startTime = performance.now();
    let success = false;
    let cacheHit = false;

    try {
      const result = await handler(...(args as never[]));

      // Check if result has cache metadata
      if (
        result &&
        typeof result === "object" &&
        "hit" in result &&
        typeof result.hit === "boolean"
      ) {
        cacheHit = result.hit;
      }

      success = true;
      return result;
    } finally {
      const latency = performance.now() - startTime;
      recordMetric(endpoint, latency, success, cacheHit);
    }
  }) as unknown as T;
}

// ============================================================================
// Performance Reporter
// ============================================================================

/**
 * Generates a performance report for monitoring.
 */
export function generatePerformanceReport(): {
  aggregate: PerformanceMetrics;
  endpoints: Record<string, PerformanceMetrics>;
  summary: {
    totalEndpoints: number;
    totalRequests: number;
    healthStatus: "healthy" | "degraded" | "unhealthy";
  };
} {
  const endpointMetrics: Record<string, PerformanceMetrics> = {};

  for (const [endpoint] of metrics.entries()) {
    const metrics = getMetrics(endpoint);
    if (metrics) {
      endpointMetrics[endpoint] = metrics;
    }
  }

  const aggregate = getAggregateMetrics();

  // Determine health status
  let healthStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (aggregate.errorRate > 0.1 || aggregate.p99Latency > 5000) {
    healthStatus = "unhealthy";
  } else if (aggregate.errorRate > 0.05 || aggregate.p99Latency > 2000) {
    healthStatus = "degraded";
  }

  return {
    aggregate,
    endpoints: endpointMetrics,
    summary: {
      totalEndpoints: Object.keys(endpointMetrics).length,
      totalRequests: aggregate.requestCount,
      healthStatus,
    },
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Periodically cleans up old metrics.
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - MAX_AGE_MS;

    for (const [endpoint, endpointMetrics] of metrics.entries()) {
      // Remove old metrics
      let i = 0;
      while (
        i < endpointMetrics.length &&
        endpointMetrics[i].timestamp < cutoff
      ) {
        i++;
      }
      if (i > 0) {
        endpointMetrics.splice(0, i);
      }

      // Remove empty endpoint entries
      if (endpointMetrics.length === 0) {
        metrics.delete(endpoint);
      }
    }
  }, 60000); // Every minute
}
