import "server-only";

import { NextRequest } from "next/server";

import {
  apiError,
  apiSuccess,
  CACHE_CONTROL,
  generateRequestId,
} from "../../../lib/apiResponse";
import { getClientIdentifier, rateLimit } from "../../../lib/rateLimit";
import {
  getRecommendations,
  resolveRecommendationQuery,
} from "../../../lib/recommendations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = performance.now();

  const clientId = getClientIdentifier(request);
  const rateLimitResult = await rateLimit({
    identifier: `recs:${clientId}`,
    limit: 30,
    windowSeconds: 60,
  });

  if (!rateLimitResult.ok) {
    return apiError("RATE_LIMITED", "Rate limit exceeded", {
      status: 429,
      headers: {
        requestId,
        cacheControl: CACHE_CONTROL.NO_STORE,
        rateLimit: {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.resetSeconds,
          retryAfter: rateLimitResult.retryAfter,
        },
      },
    });
  }

  const searchParams = request.nextUrl.searchParams;

  const q = searchParams.get("q");
  const slug = searchParams.get("slug");
  const tweetId = searchParams.get("tweetId");

  const limitArticles = parseInt(searchParams.get("limitArticles") || "8", 10);
  const limitTweets = parseInt(searchParams.get("limitTweets") || "8", 10);
  const minLikes = parseInt(searchParams.get("minLikes") || "0", 10);
  const minScore = parseFloat(searchParams.get("minScore") || "0.12");

  const resolved = await resolveRecommendationQuery({ q, slug, tweetId });
  if (!resolved) {
    return apiError("BAD_REQUEST", "Provide ?q=, ?slug=, or ?tweetId=", {
      status: 400,
      headers: {
        requestId,
        cacheControl: CACHE_CONTROL.NO_STORE,
        rateLimit: {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.resetSeconds,
        },
      },
    });
  }

  if (resolved.query.length > 500) {
    return apiError("BAD_REQUEST", "Query must be 500 characters or less", {
      status: 400,
      headers: {
        requestId,
        cacheControl: CACHE_CONTROL.NO_STORE,
        rateLimit: {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.resetSeconds,
        },
      },
    });
  }

  try {
    const data = await getRecommendations({
      query: resolved.query,
      keywords: resolved.keywords,
      limitArticles: Number.isFinite(limitArticles) ? limitArticles : undefined,
      limitTweets: Number.isFinite(limitTweets) ? limitTweets : undefined,
      minLikes: Number.isFinite(minLikes) ? minLikes : undefined,
      minScore: Number.isFinite(minScore) ? minScore : undefined,
    });

    const responseTime = Math.round(performance.now() - startTime);

    return apiSuccess(data, {
      headers: {
        requestId,
        cacheControl: CACHE_CONTROL.SHORT,
        responseTime,
        rateLimit: {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.resetSeconds,
        },
      },
      meta: {
        version: "v1",
      },
    });
  } catch (error) {
    console.error("[api/recommendations] Error:", error);
    return apiError("INTERNAL_ERROR", "Failed to generate recommendations", {
      status: 500,
      headers: {
        requestId,
        cacheControl: CACHE_CONTROL.NO_STORE,
      },
    });
  }
}
