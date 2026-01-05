/**
 * RAG API Health Check Endpoint
 *
 * GET /api/rag/health
 *
 * Returns health status of the RAG API including database connectivity,
 * data availability, and API readiness.
 *
 * Response:
 * {
 *   "status": "healthy" | "degraded" | "unhealthy",
 *   "timestamp": "...",
 *   "api_version": "1.0",
 *   "checks": {
 *     "database": { "status": "healthy", "latency_ms": 12 },
 *     "content_cache": { "status": "healthy", "record_count": 573 },
 *     "paa_tree": { "status": "healthy", "record_count": 265 },
 *     "cluster_pages": { "status": "healthy", "record_count": 573 }
 *   },
 *   "uptime_seconds": 12345
 * }
 *
 * No authentication required (public health check)
 */

import "server-only";

import { NextResponse } from "next/server";
import { getDbPool } from "../../../../lib/db";
import {
  createStandardHeaders,
  CACHE_CONTROL,
  generateRequestId,
} from "../../../../lib/apiResponse";

// Skip static export
export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface ComponentCheck {
  status: HealthStatus;
  latency_ms?: number;
  record_count?: number;
  error?: string;
}

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  api_version: string;
  checks: {
    database: ComponentCheck;
    content_cache: ComponentCheck;
    paa_tree: ComponentCheck;
    cluster_pages: ComponentCheck;
  };
  uptime_seconds: number;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ComponentCheck> {
  const pool = getDbPool();
  if (!pool) {
    return {
      status: "unhealthy",
      error: "Database pool not initialized",
    };
  }

  const startTime = performance.now();

  try {
    await pool.query("SELECT 1");
    const latency = Math.round(performance.now() - startTime);

    return {
      status: latency > 1000 ? "degraded" : "healthy",
      latency_ms: latency,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latency_ms: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check content_cache table
 */
async function checkContentCache(): Promise<ComponentCheck> {
  const pool = getDbPool();
  if (!pool) {
    return { status: "unhealthy", error: "No database" };
  }

  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM elongoat.content_cache",
    );
    const count = parseInt(result.rows[0]?.count || "0", 10);

    return {
      status: count > 0 ? "healthy" : "degraded",
      record_count: count,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Query failed",
    };
  }
}

/**
 * Check paa_tree table
 */
async function checkPaaTree(): Promise<ComponentCheck> {
  const pool = getDbPool();
  if (!pool) {
    return { status: "unhealthy", error: "No database" };
  }

  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM elongoat.paa_tree",
    );
    const count = parseInt(result.rows[0]?.count || "0", 10);

    return {
      status: count > 0 ? "healthy" : "degraded",
      record_count: count,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Query failed",
    };
  }
}

/**
 * Check cluster_pages table
 */
async function checkClusterPages(): Promise<ComponentCheck> {
  const pool = getDbPool();
  if (!pool) {
    return { status: "unhealthy", error: "No database" };
  }

  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM elongoat.cluster_pages",
    );
    const count = parseInt(result.rows[0]?.count || "0", 10);

    return {
      status: count > 0 ? "healthy" : "degraded",
      record_count: count,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Query failed",
    };
  }
}

/**
 * Calculate overall health status
 */
function calculateOverallStatus(
  checks: HealthResponse["checks"],
): HealthStatus {
  const statuses = Object.values(checks).map((c) => c.status);

  // If any critical component is unhealthy, overall is unhealthy
  if (checks.database.status === "unhealthy") {
    return "unhealthy";
  }

  // If database is OK but data tables are unhealthy, still unhealthy
  const dataUnhealthy = statuses.filter((s) => s === "unhealthy").length;
  if (dataUnhealthy >= 2) {
    return "unhealthy";
  }

  // If any component is degraded or single unhealthy, overall is degraded
  const anyDegraded = statuses.some(
    (s) => s === "degraded" || s === "unhealthy",
  );
  if (anyDegraded) {
    return "degraded";
  }

  return "healthy";
}

export async function GET() {
  const requestId = generateRequestId();
  const startTime = performance.now();

  // Run all checks in parallel
  const [database, contentCache, paaTree, clusterPages] = await Promise.all([
    checkDatabase(),
    checkContentCache(),
    checkPaaTree(),
    checkClusterPages(),
  ]);

  const checks = {
    database,
    content_cache: contentCache,
    paa_tree: paaTree,
    cluster_pages: clusterPages,
  };

  const status = calculateOverallStatus(checks);
  const responseTime = Math.round(performance.now() - startTime);

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    api_version: "1.0",
    checks,
    uptime_seconds: Math.round(process.uptime()),
  };

  const httpStatus = status === "healthy" ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      ...createStandardHeaders({
        requestId,
        cacheControl: CACHE_CONTROL.NO_STORE,
        additionalHeaders: {
          "X-Response-Time": `${responseTime}ms`,
          "X-Health-Status": status,
        },
      }),
      // CORS for health checks
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}
