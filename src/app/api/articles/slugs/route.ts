/**
 * Article Slugs API - Returns all cluster article slugs for static generation
 * GET /api/articles/slugs
 */
import { NextResponse } from "next/server";
import { getDbPool } from "../../../../lib/db";
import { rateLimitApi, rateLimitResponse } from "../../../../lib/rateLimit";
import { dynamicExport, revalidateExport } from "../../../../lib/apiExport";

// Force dynamic - must query database each time
// Skip for static export build
export const dynamic = dynamicExport("force-dynamic");
export const revalidate = revalidateExport(0);

export async function GET(request: Request) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  const pool = getDbPool();
  console.log(
    "[API /articles/slugs] Pool status:",
    pool ? "connected" : "null",
  );
  if (!pool) {
    console.error("[API /articles/slugs] Database pool not available");
    return NextResponse.json(
      { slugs: [], error: "Database not connected" },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  }

  try {
    const result = await pool.query<{ slug: string }>(
      `SELECT slug FROM elongoat.content_cache
       WHERE kind = 'cluster'
         AND (expires_at IS NULL OR expires_at > NOW())
         AND content_md IS NOT NULL
         AND LENGTH(content_md) > 500
       ORDER BY slug`,
    );

    const slugs = result.rows.map((row) => row.slug);

    return NextResponse.json(
      { slugs, total: slugs.length },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  } catch (error) {
    console.error("[API /articles/slugs] Error:", error);
    return NextResponse.json(
      { slugs: [], error: "Failed to fetch slugs" },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
