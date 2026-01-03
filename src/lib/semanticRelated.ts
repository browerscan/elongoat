/**
 * Semantic Related Content Utility
 *
 * Fetches related content using embedding-based similarity via ragHybridSearch.
 * Falls back to keyword matching when embeddings are not available.
 */

import "server-only";

import type { SemanticRelatedItem } from "@/components/SemanticRelatedContent";
import { isEmbeddingEnabled } from "@/lib/embeddings";

// ============================================================================
// Types
// ============================================================================

export interface GetSemanticRelatedOptions {
  query: string;
  currentSlug?: string;
  limit?: number;
  sources?: Array<"content_cache" | "paa" | "cluster">;
  minScore?: number;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get semantically related content for a page
 *
 * Uses hybrid search (full-text + vector) when embeddings are available,
 * falls back to full-text only search otherwise.
 */
export async function getSemanticRelatedContent(
  options: GetSemanticRelatedOptions,
): Promise<SemanticRelatedItem[]> {
  const {
    query,
    currentSlug,
    limit = 8,
    sources = ["content_cache", "paa", "cluster"],
    minScore = 0.1,
  } = options;

  // Skip if query is too short
  if (query.length < 3) {
    return [];
  }

  try {
    // Check if embeddings are available
    const useHybrid = isEmbeddingEnabled();

    if (useHybrid) {
      // Use hybrid search with embeddings
      const { hybridSearch } = await import("@/lib/ragHybridSearch");
      const result = await hybridSearch({
        query,
        sources,
        limit: limit + 5, // Get extra to filter out current
        minScore,
        fullTextWeight: 0.4,
        semanticWeight: 0.6,
      });

      return result.results
        .filter((r) => r.slug !== currentSlug)
        .slice(0, limit)
        .map((r) => ({
          title: r.title,
          url: r.url.replace(process.env.NEXT_PUBLIC_SITE_URL || "", ""),
          relevance_score: r.relevance_score,
          source: r.source,
          snippet: r.content?.slice(0, 150),
        }));
    } else {
      // Fall back to full-text search
      const { ragSearch } = await import("@/lib/ragSearch");
      const result = await ragSearch({
        query,
        sources,
        limit: limit + 5,
        minScore,
      });

      return result.results
        .filter((r) => r.slug !== currentSlug)
        .slice(0, limit)
        .map((r) => ({
          title: r.title,
          url: r.url.replace(process.env.NEXT_PUBLIC_SITE_URL || "", ""),
          relevance_score: r.relevance_score,
          source: r.source,
          snippet: r.content?.slice(0, 150),
        }));
    }
  } catch (error) {
    console.error("[Semantic Related] Error:", error);
    return [];
  }
}

/**
 * Get similar articles using embedding similarity only
 * Requires embeddings to be available
 */
export async function getSimilarByEmbedding(
  slug: string,
  limit: number = 6,
): Promise<SemanticRelatedItem[]> {
  if (!isEmbeddingEnabled()) {
    return [];
  }

  try {
    const { getSimilarArticles } = await import("@/lib/ragHybridSearch");
    const results = await getSimilarArticles(slug, limit);

    return results.map((r) => ({
      title: r.title,
      url: r.url.replace(process.env.NEXT_PUBLIC_SITE_URL || "", ""),
      relevance_score: r.relevance_score,
      source: r.source,
      snippet: r.content?.slice(0, 150),
    }));
  } catch (error) {
    console.error("[Similar By Embedding] Error:", error);
    return [];
  }
}

/**
 * Build a semantic query from page metadata
 */
export function buildSemanticQuery(params: {
  title: string;
  topic?: string;
  keywords?: string[];
  questionText?: string;
}): string {
  const parts: string[] = [];

  if (params.title) {
    parts.push(params.title);
  }

  if (params.topic) {
    parts.push(params.topic);
  }

  if (params.questionText) {
    parts.push(params.questionText);
  }

  if (params.keywords && params.keywords.length > 0) {
    parts.push(params.keywords.slice(0, 5).join(" "));
  }

  return parts.join(" ").slice(0, 500);
}
