/**
 * Tweet Search API
 * GET /api/tweets/search?q=query&limit=20&minLikes=0
 */
import { NextRequest, NextResponse } from "next/server";
import { searchTweets, getTweetStats } from "../../../../lib/muskTweets";
import { rateLimitApi, rateLimitResponse } from "../../../../lib/rateLimit";
import { dynamicExport } from "../../../../lib/apiExport";

export const dynamic = dynamicExport("force-dynamic");

export async function GET(request: NextRequest) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const minLikes = parseInt(searchParams.get("minLikes") || "0", 10);
  const includeReplies = searchParams.get("includeReplies") !== "false";

  if (!query) {
    // Return stats if no query
    const stats = await getTweetStats();
    return NextResponse.json(
      {
        error: null,
        stats,
        tweets: [],
        message: "Provide a search query with ?q=keyword",
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  }

  try {
    const tweets = await searchTweets({
      query,
      limit,
      minLikes,
      includeReplies,
    });

    return NextResponse.json(
      {
        error: null,
        query,
        count: tweets.length,
        tweets,
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  } catch (error) {
    console.error("[api/tweets/search] Error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
