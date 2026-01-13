/**
 * RAG Article Detail API Endpoint
 *
 * GET /api/rag/article/{slug}
 *
 * Retrieves full article content by slug from content_cache.
 * Supports both cluster articles (topic/page) and PAA questions.
 *
 * URL params:
 * - slug: Article slug (e.g., "net-worth/elon-musk-net-worth-2024" or "how-old-is-elon-musk")
 *
 * Response:
 * {
 *   "found": true,
 *   "article": {
 *     "slug": "...",
 *     "kind": "cluster" | "paa",
 *     "title": "...",
 *     "content": "...",
 *     "model": "...",
 *     "word_count": 1234,
 *     "generated_at": "...",
 *     "url": "..."
 *   }
 * }
 *
 * Authentication: X-API-Key header required
 */

import "server-only";

import { NextResponse } from "next/server";
import {
  validateRagAuth,
  RAG_RATE_LIMIT_CONFIG,
} from "../../../../../lib/ragAuth";
import { getArticleBySlug } from "../../../../../lib/ragSearch";
import {
  rateLimit,
  getClientIdentifier,
  buildRateLimitHeaders,
} from "../../../../../lib/rateLimit";
import {
  createStandardHeaders,
  CACHE_CONTROL,
  generateRequestId,
} from "../../../../../lib/apiResponse";
import { dynamicExport } from "../../../../../lib/apiExport";

// API routes are backend-only - skip during static export
export function generateStaticParams() {
  return [{ slug: "__placeholder__" }];
}

// Skip static export
export const dynamic = dynamicExport("error");

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
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
    identifier: `rag:article:${clientId}`,
    limit: RAG_RATE_LIMIT_CONFIG.article.limit,
    windowSeconds: RAG_RATE_LIMIT_CONFIG.article.windowSeconds,
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

  // Get slug from params - handle URL-encoded slashes for nested slugs
  const { slug: rawSlug } = await params;

  // Decode the slug (handles %2F for nested paths like "topic/page")
  const slug = decodeURIComponent(rawSlug);

  if (!slug || slug.length < 1) {
    return NextResponse.json(
      { error: "Slug is required" },
      {
        status: 400,
        headers: createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.NO_STORE,
        }),
      },
    );
  }

  try {
    const result = await getArticleBySlug(slug);
    const responseTime = Math.round(performance.now() - startTime);

    if (!result.found) {
      return NextResponse.json(
        { found: false, error: "Article not found" },
        {
          status: 404,
          headers: {
            ...buildRateLimitHeaders(rateLimitResult),
            ...createStandardHeaders({
              requestId,
              cacheControl: CACHE_CONTROL.SHORT,
              additionalHeaders: {
                "X-Response-Time": `${responseTime}ms`,
              },
            }),
          },
        },
      );
    }

    return NextResponse.json(result, {
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
    });
  } catch (error) {
    console.error("[RAG Article API] Error:", error);

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
