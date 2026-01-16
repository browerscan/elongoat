import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { findPaaQuestion } from "../../../../../lib/indexes";
import { getCustomQa } from "../../../../../lib/customQa";
import { getPaaAnswerContent } from "../../../../../lib/contentGen";
import { getDynamicVariables } from "../../../../../lib/variables";
import { rateLimitApi, rateLimitResponse } from "../../../../../lib/rateLimit";

const isStaticExport = process.env.NEXT_BUILD_TARGET === "export";

// API routes are backend-only - skip during static export
export function generateStaticParams() {
  return isStaticExport ? [{ slug: "__placeholder__" }] : [];
}

// API routes are backend-only
export const dynamic = isStaticExport ? "error" : "force-dynamic";

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

    const customQa = await getCustomQa(slug);
    if (customQa) {
      const variables = await getDynamicVariables();
      return NextResponse.json(
        {
          found: true,
          question: customQa.question,
          answer: customQa.answerMd
            .replace(/\{age\}/g, String(variables.age))
            .replace(/\{net_worth\}/g, String(variables.net_worth)),
          variables,
        },
        { headers: rlHeaders as unknown as HeadersInit },
      );
    }

    const paaQuestion = await findPaaQuestion(slug);
    if (!paaQuestion) {
      return NextResponse.json(
        { found: false, error: "Question not found" },
        { status: 404, headers: rlHeaders as unknown as HeadersInit },
      );
    }

    const variables = await getDynamicVariables();
    const content = await getPaaAnswerContent({ slug });

    return NextResponse.json(
      {
        found: true,
        question: paaQuestion.question,
        answer: content.contentMd,
        variables,
      },
      { headers: rlHeaders as unknown as HeadersInit },
    );
  } catch (error) {
    console.error("[API /data/qa] Error:", error);
    return NextResponse.json(
      { found: false, error: "Internal server error" },
      { status: 500, headers: rlHeaders as unknown as HeadersInit },
    );
  }
}
