import "server-only";

import { NextResponse } from "next/server";

import {
  getClusterIndex,
  getPaaIndex,
  getTopPageSlugs,
  getTopQuestionSlugs,
} from "@/lib/indexes";
import { getDynamicVariables } from "@/lib/variables";

export const revalidate = 3600;

export async function GET() {
  try {
    const [cluster, paa, topPages, topQuestions, variables] = await Promise.all(
      [
        getClusterIndex(),
        getPaaIndex(),
        getTopPageSlugs(),
        getTopQuestionSlugs(),
        getDynamicVariables(),
      ],
    );

    return NextResponse.json({
      cluster: {
        generatedAt: cluster.generatedAt,
        source: cluster.source,
        topics: cluster.topics,
        totalPages: cluster.pages.length,
      },
      paa: {
        generatedAt: paa.generatedAt,
        source: paa.source,
        totalQuestions: paa.questions.length,
      },
      topPages,
      topQuestions,
      variables,
    });
  } catch (error) {
    console.error("Error fetching cluster data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cluster data" },
      { status: 500 },
    );
  }
}
