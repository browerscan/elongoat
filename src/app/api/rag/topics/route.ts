/**
 * RAG Topics List API Endpoint
 *
 * GET /api/rag/topics
 *
 * Returns list of all topics (categories) with page counts and search volume.
 *
 * Response:
 * {
 *   "topics": [
 *     {
 *       "topic": "Net Worth",
 *       "slug": "net-worth",
 *       "page_count": 45,
 *       "total_volume": 125000
 *     },
 *     ...
 *   ],
 *   "total_topics": 12,
 *   "total_pages": 573
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
import { getTopicsList } from "../../../../lib/ragSearch";
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
    identifier: `rag:topics:${clientId}`,
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
    const topics = await getTopicsList();
    const responseTime = Math.round(performance.now() - startTime);

    // Calculate totals
    const totalPages = topics.reduce((sum, t) => sum + t.page_count, 0);
    const totalVolume = topics.reduce((sum, t) => sum + t.total_volume, 0);

    return NextResponse.json(
      {
        topics,
        total_topics: topics.length,
        total_pages: totalPages,
        total_volume: totalVolume,
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
    console.error("[RAG Topics API] Error:", error);

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
