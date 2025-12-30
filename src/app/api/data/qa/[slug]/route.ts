import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { findPaaQuestion, getPaaIndex } from "@/lib/indexes";
import { getCustomQa } from "@/lib/customQa";
import { getPaaAnswerContent } from "@/lib/contentGen";
import { getDynamicVariables } from "@/lib/variables";

export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Check for custom Q&A first
    const customQa = await getCustomQa(slug);
    if (customQa) {
      const variables = await getDynamicVariables();
      return NextResponse.json({
        kind: "custom",
        slug: customQa.slug,
        question: customQa.question,
        contentMd: customQa.answerMd,
        model: customQa.model,
        sources: customQa.sources,
        createdAt: customQa.createdAt,
        updatedAt: customQa.updatedAt,
        variables,
      });
    }

    // Check PAA index
    const paaQuestion = await findPaaQuestion(slug);
    if (!paaQuestion) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    const [content, variables, paaIndex] = await Promise.all([
      getPaaAnswerContent({ slug }),
      getDynamicVariables(),
      getPaaIndex(),
    ]);

    return NextResponse.json({
      kind: "paa",
      slug: paaQuestion.slug,
      question: paaQuestion.question,
      parent: paaQuestion.parent,
      sourceUrl: paaQuestion.sourceUrl,
      sourceTitle: paaQuestion.sourceTitle,
      volume: paaQuestion.volume,
      content,
      variables,
      totalQuestions: paaIndex.questions.length,
    });
  } catch (error) {
    console.error("Error fetching Q&A:", error);
    return NextResponse.json({ error: "Failed to fetch Q&A" }, { status: 500 });
  }
}
