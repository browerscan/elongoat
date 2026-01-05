import "server-only";

import { NextRequest, NextResponse } from "next/server";

import {
  findPage,
  findTopic,
  listTopicPages,
  getClusterIndex,
} from "../../../../../../lib/indexes";
import { getClusterPageContent } from "../../../../../../lib/contentGen";
import { getDynamicVariables } from "../../../../../../lib/variables";

export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topic: string; page: string }> },
) {
  try {
    const { topic: topicSlug, page: pageSlug } = await params;

    const page = await findPage(topicSlug, pageSlug);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const [topic, siblingPages, content, variables, clusterIndex] =
      await Promise.all([
        findTopic(topicSlug),
        listTopicPages(topicSlug),
        getClusterPageContent({ topicSlug, pageSlug }),
        getDynamicVariables(),
        getClusterIndex(),
      ]);

    return NextResponse.json({
      page,
      topic,
      siblingPages,
      content,
      variables,
      allTopics: clusterIndex.topics,
    });
  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json(
      { error: "Failed to fetch page" },
      { status: 500 },
    );
  }
}
