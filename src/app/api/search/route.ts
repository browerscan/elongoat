import "server-only";

import { NextResponse } from "next/server";

import { getClusterIndex, getPaaIndex } from "../../../lib/indexes";
import { listVideos } from "../../../lib/videos";
import { rateLimitApi } from "../../../lib/rateLimit";

// Skip static export - this is a backend-only API route
export const dynamic = "force-dynamic";

export const revalidate = 60;

const SEARCH_LIMIT = 50;

type SearchResultItem = {
  id: string;
  title: string;
  snippet?: string;
  url: string;
  type: "topic" | "page" | "qa" | "video";
  relevance: number;
  meta?: string;
};

type SearchResponse = {
  query: string;
  results: {
    topics: SearchResultItem[];
    pages: SearchResultItem[];
    qa: SearchResultItem[];
    videos: SearchResultItem[];
  };
  totalCount: number;
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function calculateRelevance(
  query: string,
  title: string,
  snippet?: string,
): number {
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const normalizedSnippet = snippet ? normalizeText(snippet) : "";

  let score = 0;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  for (const term of terms) {
    // Exact phrase match in title
    if (normalizedTitle.includes(term)) {
      score += 10;
    }

    // Word boundary match in title (higher score)
    const wordBoundaryRegex = new RegExp(
      `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (wordBoundaryRegex.test(normalizedTitle)) {
      score += 5;
    }

    // Match in snippet
    if (normalizedSnippet.includes(term)) {
      score += 2;
    }
  }

  // Boost for starting with query
  if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 15;
  }

  return score;
}

function highlightMatch(text: string, query: string, maxLength = 160): string {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 3);

  if (terms.length === 0) return text.slice(0, maxLength);

  // Find the best matching region
  let bestStart = 0;
  let bestScore = 0;

  for (let i = 0; i < text.length; i++) {
    let score = 0;
    for (const term of terms) {
      const idx = normalizedText.indexOf(term, i);
      if (idx !== -1 && idx < i + 50) {
        score += 10 - Math.abs(idx - i) / 5;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  // Extract context around the match
  const contextStart = Math.max(0, bestStart - 40);
  const contextEnd = Math.min(
    text.length,
    bestStart + maxLength - (contextStart > 0 ? 40 : 0),
  );
  let snippet = text.slice(contextStart, contextEnd);

  // Add ellipsis if truncated
  if (contextStart > 0) snippet = "…" + snippet;
  if (contextEnd < text.length) snippet = snippet + "…";

  return snippet;
}

export async function GET(request: Request) {
  // Rate limiting
  const { result: rateLimitResult, headers: rateLimitHeaders } =
    await rateLimitApi(request);

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: rateLimitHeaders as unknown as HeadersInit,
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json<SearchResponse>(
      {
        query,
        results: { topics: [], pages: [], qa: [], videos: [] },
        totalCount: 0,
      },
      {
        headers: rateLimitHeaders as unknown as HeadersInit,
      },
    );
  }

  try {
    const [clusterIndex, paaIndex, videos] = await Promise.all([
      getClusterIndex(),
      getPaaIndex(),
      listVideos(SEARCH_LIMIT),
    ]);

    const results: SearchResponse = {
      query,
      results: { topics: [], pages: [], qa: [], videos: [] },
      totalCount: 0,
    };

    // Search topics
    for (const topic of clusterIndex.topics) {
      const relevance = calculateRelevance(query, topic.topic);
      if (relevance > 0) {
        results.results.topics.push({
          id: topic.slug,
          title: topic.topic,
          snippet: `${topic.pageCount} pages in this topic hub`,
          url: `/${topic.slug}`,
          type: "topic",
          relevance,
          meta: `${topic.pageCount} pages`,
        });
      }
    }

    // Search pages
    for (const page of clusterIndex.pages) {
      const relevance = calculateRelevance(
        query,
        page.page,
        page.topKeywords.map((k) => k.keyword).join(" "),
      );
      if (relevance > 0) {
        results.results.pages.push({
          id: page.slug,
          title: page.page,
          snippet: highlightMatch(
            `Part of ${page.topic} • Keywords: ${page.topKeywords
              .slice(0, 3)
              .map((k) => k.keyword)
              .join(", ")}`,
            query,
          ),
          url: `/${page.slug}`,
          type: "page",
          relevance,
          meta: page.topic,
        });
      }
    }

    // Search Q&A
    for (const qa of paaIndex.questions) {
      const relevance = calculateRelevance(
        query,
        qa.question,
        qa.answer ?? undefined,
      );
      if (relevance > 0) {
        results.results.qa.push({
          id: qa.slug,
          title: qa.question,
          snippet: qa.answer
            ? highlightMatch(qa.answer, query)
            : "Ask the AI for an answer.",
          url: `/q/${qa.slug}`,
          type: "qa",
          relevance,
          meta: undefined,
        });
      }
    }

    // Search videos
    for (const video of videos) {
      const title = video.title ?? video.videoId;
      const relevance = calculateRelevance(
        query,
        title,
        video.snippet ?? undefined,
      );
      if (relevance > 0) {
        results.results.videos.push({
          id: video.videoId,
          title,
          snippet: video.snippet
            ? highlightMatch(video.snippet, query)
            : (video.channel ?? "Video"),
          url: `/videos/${video.videoId}`,
          type: "video",
          relevance,
          meta: video.channel ?? undefined,
        });
      }
    }

    // Sort each category by relevance
    results.results.topics.sort((a, b) => b.relevance - a.relevance);
    results.results.pages.sort((a, b) => b.relevance - a.relevance);
    results.results.qa.sort((a, b) => b.relevance - a.relevance);
    results.results.videos.sort((a, b) => b.relevance - a.relevance);

    // Limit results per category
    results.results.topics = results.results.topics.slice(0, SEARCH_LIMIT);
    results.results.pages = results.results.pages.slice(0, SEARCH_LIMIT);
    results.results.qa = results.results.qa.slice(0, SEARCH_LIMIT);
    results.results.videos = results.results.videos.slice(0, SEARCH_LIMIT);

    results.totalCount =
      results.results.topics.length +
      results.results.pages.length +
      results.results.qa.length +
      results.results.videos.length;

    return NextResponse.json<SearchResponse>(results, {
      headers: rateLimitHeaders as unknown as HeadersInit,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json<SearchResponse>(
      {
        query,
        results: { topics: [], pages: [], qa: [], videos: [] },
        totalCount: 0,
      },
      { status: 500 },
    );
  }
}

export type { SearchResponse, SearchResultItem };
