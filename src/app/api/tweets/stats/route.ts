/**
 * Tweet Stats API
 * GET /api/tweets/stats
 */
import { NextResponse } from "next/server";
import {
  getTweetStats,
  getTweetCountsByYear,
} from "../../../../lib/muskTweets";
import { rateLimitApi, rateLimitResponse } from "../../../../lib/rateLimit";

export const revalidate = 3600; // Cache for 1 hour

export async function GET(request: Request) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  try {
    const [stats, yearCounts] = await Promise.all([
      getTweetStats(),
      getTweetCountsByYear(),
    ]);

    return NextResponse.json(
      {
        error: null,
        stats,
        yearCounts,
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  } catch (error) {
    console.error("[api/tweets/stats] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
