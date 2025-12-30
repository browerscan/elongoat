import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { findTopic, listTopicPages, getClusterIndex } from "@/lib/indexes";

export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const topic = await findTopic(slug);

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const pages = await listTopicPages(slug);
    const clusterIndex = await getClusterIndex();

    return NextResponse.json({
      topic,
      pages,
      allTopics: clusterIndex.topics,
    });
  } catch (error) {
    console.error("Error fetching topic:", error);
    return NextResponse.json(
      { error: "Failed to fetch topic" },
      { status: 500 },
    );
  }
}
