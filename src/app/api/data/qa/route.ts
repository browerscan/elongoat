import "server-only";

import { NextResponse } from "next/server";

import { getPaaIndex } from "../../../../lib/indexes";
import { listLatestCustomQas } from "../../../../lib/customQa";
import { rateLimitApi, rateLimitResponse } from "../../../../lib/rateLimit";

export const revalidate = 3600;

export async function GET(request: Request) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  try {
    const [paaIndex, customQas] = await Promise.all([
      getPaaIndex(),
      listLatestCustomQas(12),
    ]);

    return NextResponse.json(
      {
        paa: {
          generatedAt: paaIndex.generatedAt,
          source: paaIndex.source,
          questions: paaIndex.questions,
        },
        customQas,
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  } catch (error) {
    console.error("Error fetching Q&A data:", error);
    return NextResponse.json(
      { error: "Failed to fetch Q&A data" },
      { status: 500, headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
