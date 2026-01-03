/**
 * RAG Hybrid Search API Endpoint
 *
 * POST /api/rag/hybrid
 *
 * Combines full-text search with semantic vector search for improved relevance.
 * Falls back to full-text only if embeddings are not configured.
 *
 * Request body:
 * {
 *   "query": "elon musk net worth",
 *   "sources": ["content_cache", "paa", "cluster"],
 *   "limit": 10,
 *   "min_score": 0.01,
 *   "full_text_weight": 0.5,    // Optional: weight for full-text score
 *   "semantic_weight": 0.5      // Optional: weight for vector similarity
 * }
 *
 * Response includes search_mode indicating "hybrid" or "full_text_only"
 *
 * Authentication: X-API-Key header required
 */

import "server-only";

import { NextResponse } from "next/server";
import { validateRagAuth, RAG_RATE_LIMIT_CONFIG } from "@/lib/ragAuth";
import { hybridSearch, type HybridSearchOptions } from "@/lib/ragHybridSearch";
import { type RagSource } from "@/lib/ragSearch";
import {
  rateLimit,
  getClientIdentifier,
  buildRateLimitHeaders,
} from "@/lib/rateLimit";
import {
  createStandardHeaders,
  CACHE_CONTROL,
  generateRequestId,
} from "@/lib/apiResponse";

// Skip static export
export const dynamic = "force-dynamic";

// Valid sources for filtering
const VALID_SOURCES: RagSource[] = ["content_cache", "paa", "cluster"];

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const startTime = performance.now();

  // Authenticate
  const authResult = validateRagAuth(request);
  if (!authResult.authenticated && authResult.error) {
    return authResult.error;
  }

  // Rate limiting (use same config as regular search)
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await rateLimit({
    identifier: `rag:hybrid:${clientId}`,
    limit: RAG_RATE_LIMIT_CONFIG.search.limit,
    windowSeconds: RAG_RATE_LIMIT_CONFIG.search.windowSeconds,
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

  // Parse request body
  let body: {
    query?: string;
    sources?: string[];
    limit?: number;
    min_score?: number;
    full_text_weight?: number;
    semantic_weight?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      {
        status: 400,
        headers: createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.NO_STORE,
        }),
      },
    );
  }

  // Validate query
  const query = body.query?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query is required and must be at least 2 characters" },
      {
        status: 400,
        headers: createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.NO_STORE,
        }),
      },
    );
  }

  if (query.length > 500) {
    return NextResponse.json(
      { error: "Query must be 500 characters or less" },
      {
        status: 400,
        headers: createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.NO_STORE,
        }),
      },
    );
  }

  // Validate sources
  let sources: RagSource[] = VALID_SOURCES;
  if (body.sources && Array.isArray(body.sources)) {
    const filteredSources = body.sources.filter((s): s is RagSource =>
      VALID_SOURCES.includes(s as RagSource),
    );
    if (filteredSources.length > 0) {
      sources = filteredSources;
    }
  }

  // Validate limit
  let limit = 10;
  if (body.limit !== undefined) {
    limit = Math.max(1, Math.min(50, Math.floor(body.limit)));
  }

  // Validate min_score
  let minScore = 0.01;
  if (body.min_score !== undefined && typeof body.min_score === "number") {
    minScore = Math.max(0, body.min_score);
  }

  // Validate weights
  let fullTextWeight = 0.5;
  let semanticWeight = 0.5;

  if (
    body.full_text_weight !== undefined &&
    typeof body.full_text_weight === "number"
  ) {
    fullTextWeight = Math.max(0, Math.min(1, body.full_text_weight));
  }

  if (
    body.semantic_weight !== undefined &&
    typeof body.semantic_weight === "number"
  ) {
    semanticWeight = Math.max(0, Math.min(1, body.semantic_weight));
  }

  // Normalize weights to sum to 1
  const totalWeight = fullTextWeight + semanticWeight;
  if (totalWeight > 0) {
    fullTextWeight = fullTextWeight / totalWeight;
    semanticWeight = semanticWeight / totalWeight;
  }

  try {
    const searchOptions: HybridSearchOptions = {
      query,
      sources,
      limit,
      minScore,
      useVectorSearch: true,
      fullTextWeight,
      semanticWeight,
    };

    const searchResult = await hybridSearch(searchOptions);
    const responseTime = Math.round(performance.now() - startTime);

    return NextResponse.json(searchResult, {
      status: 200,
      headers: {
        ...buildRateLimitHeaders(rateLimitResult),
        ...createStandardHeaders({
          requestId,
          cacheControl: CACHE_CONTROL.SHORT,
          additionalHeaders: {
            "X-Response-Time": `${responseTime}ms`,
            "X-Search-Mode": searchResult.metadata.search_mode,
          },
        }),
      },
    });
  } catch (error) {
    console.error("[RAG Hybrid Search API] Error:", error);

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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
