/**
 * RAG Statistics API Endpoint
 *
 * GET /api/rag/stats
 *
 * Returns statistics about the ElonGoat knowledge base.
 *
 * Response:
 * {
 *   "content_cache": { "total": 573, "by_kind": { "cluster": 573 } },
 *   "paa_tree": { "total": 265, "with_answers": 200 },
 *   "cluster_pages": { "total": 573, "total_keywords": 3871 },
 *   "topics": { "count": 12 },
 *   "last_updated": "2024-01-15T12:00:00.000Z"
 * }
 *
 * Authentication: X-API-Key header required
 */

import "server-only";

import { NextResponse } from "next/server";
import {
  validateRagAuth,
  RAG_RATE_LIMIT_CONFIG,
} from "../../../../lib/ragAuth";
import { getRagStats, SOURCE_WEIGHTS } from "../../../../lib/ragSearch";
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

// Skip static export
export const dynamic = "force-dynamic";

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
    identifier: `rag:stats:${clientId}`,
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
    const stats = await getRagStats();
    const responseTime = Math.round(performance.now() - startTime);

    return NextResponse.json(
      {
        ...stats,
        source_weights: SOURCE_WEIGHTS,
        api_version: "1.0",
      },
      {
        status: 200,
        headers: {
          ...buildRateLimitHeaders(rateLimitResult),
          ...createStandardHeaders({
            requestId,
            cacheControl: CACHE_CONTROL.MEDIUM,
            additionalHeaders: {
              "X-Response-Time": `${responseTime}ms`,
            },
          }),
        },
      },
    );
  } catch (error) {
    console.error("[RAG Stats API] Error:", error);

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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
