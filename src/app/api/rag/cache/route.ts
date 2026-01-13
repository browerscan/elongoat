/**
 * RAG Cache Admin API Endpoint
 *
 * GET /api/rag/cache - Get cache statistics
 * DELETE /api/rag/cache - Clear all cache
 *
 * Authentication: X-API-Key header required
 */

import "server-only";

import { NextResponse } from "next/server";
import {
  validateRagAuth,
  RAG_RATE_LIMIT_CONFIG,
} from "../../../../lib/ragAuth";
import {
  getCacheStats,
  clearAllCache,
  getCacheConfig,
  isCachingEnabled,
} from "../../../../lib/ragCache";
import {
  rateLimit,
  getClientIdentifier,
  buildRateLimitHeaders,
} from "../../../../lib/rateLimit";
import {
  createStandardHeaders,
  CACHE_CONTROL,
  generateRequestId,
} from "../../../../lib/apiResponse";
import { dynamicExport } from "../../../../lib/apiExport";

// Skip static export
export const dynamic = dynamicExport("force-dynamic");

/**
 * GET /api/rag/cache - Get cache statistics
 */
export async function GET(request: Request) {
  const requestId = generateRequestId();
  const startTime = performance.now();

  // Authenticate
  const authResult = validateRagAuth(request);
  if (!authResult.authenticated && authResult.error) {
    return authResult.error;
  }

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await rateLimit({
    identifier: `rag:cache:${clientId}`,
    limit: RAG_RATE_LIMIT_CONFIG.meta.limit,
    windowSeconds: RAG_RATE_LIMIT_CONFIG.meta.windowSeconds,
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.resetSeconds,
      },
      {
        status: 429,
        headers: {
          ...buildRateLimitHeaders(rateLimitResult),
          ...createStandardHeaders({
            requestId,
            cacheControl: CACHE_CONTROL.NO_STORE,
          }),
        },
      },
    );
  }

  try {
    const config = getCacheConfig();
    const stats = await getCacheStats();
    const responseTime = Math.round(performance.now() - startTime);

    return NextResponse.json(
      {
        enabled: isCachingEnabled(),
        config: {
          ttl_seconds: config.ttlSeconds,
          enabled: config.enabled,
        },
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          hit_rate_percent: stats.hitRate,
          total_requests: stats.hits + stats.misses,
        },
      },
      {
        status: 200,
        headers: {
          ...buildRateLimitHeaders(rateLimitResult),
          ...createStandardHeaders({
            requestId,
            cacheControl: CACHE_CONTROL.NO_STORE,
            additionalHeaders: {
              "X-Response-Time": `${responseTime}ms`,
            },
          }),
        },
      },
    );
  } catch (error) {
    console.error("[RAG Cache API] Error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.NO_STORE,
        }),
      },
    );
  }
}

/**
 * DELETE /api/rag/cache - Clear all cache
 */
export async function DELETE(request: Request) {
  const requestId = generateRequestId();
  const startTime = performance.now();

  // Authenticate
  const authResult = validateRagAuth(request);
  if (!authResult.authenticated && authResult.error) {
    return authResult.error;
  }

  // Rate limiting (more restrictive for destructive action)
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await rateLimit({
    identifier: `rag:cache:clear:${clientId}`,
    limit: 10,
    windowSeconds: 60,
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retry_after: rateLimitResult.resetSeconds,
      },
      {
        status: 429,
        headers: {
          ...buildRateLimitHeaders(rateLimitResult),
          ...createStandardHeaders({
            requestId,
            cacheControl: CACHE_CONTROL.NO_STORE,
          }),
        },
      },
    );
  }

  try {
    const clearedCount = await clearAllCache();
    const responseTime = Math.round(performance.now() - startTime);

    return NextResponse.json(
      {
        success: true,
        cleared_entries: clearedCount,
        message: `Cleared ${clearedCount} cache entries`,
      },
      {
        status: 200,
        headers: {
          ...buildRateLimitHeaders(rateLimitResult),
          ...createStandardHeaders({
            requestId,
            cacheControl: CACHE_CONTROL.NO_STORE,
            additionalHeaders: {
              "X-Response-Time": `${responseTime}ms`,
            },
          }),
        },
      },
    );
  } catch (error) {
    console.error("[RAG Cache API] Error clearing cache:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.NO_STORE,
        }),
      },
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
