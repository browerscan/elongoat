import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { findTopic, listTopicPages } from "../../../../../lib/indexes";
import { rateLimitApi, rateLimitResponse } from "../../../../../lib/rateLimit";

// API routes are backend-only - skip during static export
export function generateStaticParams() {
  return [{ slug: "__placeholder__" }];
}

// API routes are backend-only
export const dynamic = "error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  try {
    const { slug } = await params;

    const topic = await findTopic(slug);
    if (!topic) {
      return NextResponse.json(
        { found: false, error: "Topic not found" },
        { status: 404, headers: rlHeaders as unknown as HeadersInit },
      );
    }

    const pages = (await listTopicPages(slug)).slice(0, 100);

    return NextResponse.json(
      {
        found: true,
        topic: {
          slug: topic.slug,
          topic: topic.topic,
          pageCount: pages.length,
          pages: pages.map((p) => ({
            pageSlug: p.pageSlug,
            page: p.page,
            maxVolume: p.maxVolume,
            keywordCount: p.keywordCount,
          })),
        },
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  } catch (error) {
    console.error("[API /data/topic] Error:", error);
    return NextResponse.json(
      { found: false, error: "Internal server error" },
      { status: 500, headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
