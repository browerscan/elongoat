import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { findPage } from "../../../../../../lib/indexes";
import { getClusterPageContent } from "../../../../../../lib/contentGen";
import { getDynamicVariables } from "../../../../../../lib/variables";
import {
  rateLimitApi,
  rateLimitResponse,
} from "../../../../../../lib/rateLimit";

// API routes are backend-only - skip during static export
export function generateStaticParams() {
  return [{ topic: "__placeholder__", page: "__placeholder__" }];
}

export const dynamic = "error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topic: string; page: string }> },
) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  try {
    const { topic, page } = await params;

    const pageData = await findPage(topic, page);
    if (!pageData) {
      return NextResponse.json(
        { found: false, error: "Page not found" },
        { status: 404, headers: rlHeaders as unknown as HeadersInit },
      );
    }

    const vars = await getDynamicVariables();

    const content = await getClusterPageContent({
      topicSlug: topic,
      pageSlug: page,
    });

    return NextResponse.json(
      {
        found: true,
        page: {
          topic: pageData.topic,
          page: pageData.page,
          topicSlug: pageData.topicSlug,
          pageSlug: pageData.pageSlug,
          maxVolume: pageData.maxVolume,
          keywordCount: pageData.keywordCount,
          content: content.contentMd,
          model: content.model,
        },
        variables: vars,
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  } catch (error) {
    console.error("[API /data/page] Error:", error);
    return NextResponse.json(
      { found: false, error: "Internal server error" },
      { status: 500, headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
