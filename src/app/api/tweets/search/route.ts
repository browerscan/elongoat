/**
 * Tweet Search API
 * GET /api/tweets/search?q=query&limit=20&minLikes=0
 */
import { NextRequest, NextResponse } from "next/server";
import { searchTweets, getTweetStats } from "../../../../lib/muskTweets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const minLikes = parseInt(searchParams.get("minLikes") || "0", 10);
  const includeReplies = searchParams.get("includeReplies") !== "false";

  if (!query) {
    // Return stats if no query
    const stats = await getTweetStats();
    return NextResponse.json({
      error: null,
      stats,
      tweets: [],
      message: "Provide a search query with ?q=keyword",
    });
  }

  try {
    const tweets = await searchTweets({
      query,
      limit,
      minLikes,
      includeReplies,
    });

    return NextResponse.json({
      error: null,
      query,
      count: tweets.length,
      tweets,
    });
  } catch (error) {
    console.error("[api/tweets/search] Error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
