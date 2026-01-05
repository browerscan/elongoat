/**
 * Article Listing API
 *
 * GET /api/articles
 *   ?kind=cluster|paa       (optional filter)
 *   ?sort=updated|title     (default: updated)
 *   ?limit=24               (1-100, default 24)
 *   ?offset=0               (pagination)
 *   ?search=query           (full-text search)
 */
import { NextRequest, NextResponse } from "next/server";
import { listArticles } from "../../../lib/articles";

export const revalidate = 3600; // 1 hour cache

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const kind = searchParams.get("kind") as "cluster" | "paa" | null;
  const sort = (searchParams.get("sort") || "updated") as "updated" | "title";
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "24", 10)),
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
  const search = searchParams.get("search") || undefined;

  try {
    const result = await listArticles({ kind, sort, limit, offset, search });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[API /articles] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 },
    );
  }
}
