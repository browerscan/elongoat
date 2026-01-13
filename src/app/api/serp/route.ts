/**
 * SERP API Endpoint
 *
 * GET /api/serp?query=elon+musk
 * POST /api/serp { "query": "elon musk", "force": false }
 *
 * Real-time Google SERP data via Proxy-Grid API.
 * Returns organic results, People Also Ask, and related searches.
 *
 * Query parameters:
 * - query: Search query (required)
 * - force: Bypass cache (default: false)
 * - limit: Max results (default: 10, max: 50)
 *
 * Response:
 * {
 *   "query": "elon musk",
 *   "results": [{ title, link, snippet, position }],
 *   "peopleAlsoAsk": [{ question, snippet, link, position }],
 *   "relatedSearches": ["string"],
 *   "cached": true
 * }
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  googleSerp,
  getPeopleAlsoAsk,
  getRelatedSearches,
  analyzeSerp,
  clearProxyGridCache,
  getProxyGridCacheStats,
} from "../../../lib/proxyGrid";
import { dynamicExport } from "../../../lib/apiExport";

// Skip static export
export const dynamic = dynamicExport("force-dynamic");

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

/**
 * GET handler for simple SERP queries
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const force = searchParams.get("force") === "true";
  const limitParam = searchParams.get("limit");
  const limit = limitParam
    ? Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT),
      )
    : DEFAULT_LIMIT;

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      {
        error: "Query parameter is required and must be at least 2 characters",
      },
      { status: 400 },
    );
  }

  try {
    const [results, paa, related] = await Promise.allSettled([
      googleSerp(query.trim(), { force, useCache: !force }),
      getPeopleAlsoAsk(query.trim(), { force, useCache: !force }),
      getRelatedSearches(query.trim(), { force, useCache: !force }),
    ]);

    const data = {
      query: query.trim(),
      results:
        results.status === "fulfilled"
          ? results.value.results.slice(0, limit)
          : [],
      peopleAlsoAsk: paa.status === "fulfilled" ? paa.value : [],
      relatedSearches: related.status === "fulfilled" ? related.value : [],
      cached: !force,
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    console.error("[SERP API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch SERP data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST handler for advanced SERP queries
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query?.trim();
    const force = body.force === true;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(body.limit ?? DEFAULT_LIMIT)),
    );
    const analysis = body.analysis === true;

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query is required and must be at least 2 characters" },
        { status: 400 },
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: "Query must be 500 characters or less" },
        { status: 400 },
      );
    }

    // Return full analysis if requested
    if (analysis) {
      const serpAnalysis = await analyzeSerp(query, {
        force,
        useCache: !force,
      });
      return NextResponse.json(serpAnalysis, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      });
    }

    // Standard SERP response
    const [results, paa, related] = await Promise.allSettled([
      googleSerp(query, { force, useCache: !force }),
      getPeopleAlsoAsk(query, { force, useCache: !force }),
      getRelatedSearches(query, { force, useCache: !force }),
    ]);

    const data = {
      query,
      results:
        results.status === "fulfilled"
          ? results.value.results.slice(0, limit)
          : [],
      peopleAlsoAsk: paa.status === "fulfilled" ? paa.value : [],
      relatedSearches: related.status === "fulfilled" ? related.value : [],
      cached: !force,
      totalResults:
        results.status === "fulfilled" ? results.value.totalResults : undefined,
      searchTime:
        results.status === "fulfilled" ? results.value.searchTime : undefined,
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    console.error("[SERP API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch SERP data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE handler to clear SERP cache
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pattern = searchParams.get("pattern") || undefined;

  try {
    await clearProxyGridCache(pattern);

    const stats = getProxyGridCacheStats();

    return NextResponse.json({
      success: true,
      message: pattern
        ? `Cache cleared for pattern: ${pattern}`
        : "All SERP cache cleared",
      remaining: stats.size,
    });
  } catch (error) {
    console.error("[SERP API] Cache clear error:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
