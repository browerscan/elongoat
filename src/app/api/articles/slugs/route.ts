/**
 * Article Slugs API - Returns all cluster article slugs for static generation
 * GET /api/articles/slugs
 */
import { NextResponse } from "next/server";
import { getDbPool } from "../../../../lib/db";

export const revalidate = 3600;

export async function GET() {
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ slugs: [] });
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
        },
      },
    );
  } catch (error) {
    console.error("[API /articles/slugs] Error:", error);
    return NextResponse.json({ slugs: [], error: "Failed to fetch slugs" });
  }
}
