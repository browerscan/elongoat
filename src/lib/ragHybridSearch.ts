/**
 * Hybrid RAG Search Engine
 *
 * Combines full-text search (PostgreSQL ts_rank) with semantic vector search
 * (pgvector cosine similarity) for improved search relevance.
 *
 * When embeddings are available, uses weighted combination:
 * - Full-text score * 0.5 + Vector similarity * 0.5
 *
 * Falls back to full-text only when embeddings are not configured.
 */

import "server-only";

import { getDbPool } from "@/lib/db";
import {
  generateEmbedding,
  formatEmbeddingForPg,
  isEmbeddingEnabled,
} from "@/lib/embeddings";
import {
  ragSearch,
  type RagSearchOptions,
  type RagSearchResponse,
  type RagSource,
  SOURCE_WEIGHTS,
} from "@/lib/ragSearch";

// ============================================================================
// Types
// ============================================================================

export interface HybridSearchOptions extends RagSearchOptions {
  useVectorSearch?: boolean;
  fullTextWeight?: number;
  semanticWeight?: number;
}

export interface HybridSearchResult {
  title: string;
  content: string;
  source: RagSource;
  source_priority: number;
  relevance_score: number;
  topic?: string;
  url: string;
  slug: string;
  volume?: number;
  word_count?: number;
  full_text_score?: number;
  vector_score?: number;
}

export interface HybridSearchResponse extends RagSearchResponse {
  results: HybridSearchResult[];
  metadata: RagSearchResponse["metadata"] & {
    search_mode: "hybrid" | "full_text_only";
    vector_enabled: boolean;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FULL_TEXT_WEIGHT = 0.5;
const DEFAULT_SEMANTIC_WEIGHT = 0.5;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://elongoat.io";

// ============================================================================
// Hybrid Search Implementation
// ============================================================================

/**
 * Execute hybrid search using PostgreSQL function
 */
async function executeHybridSearchQuery(
  query: string,
  embedding: number[],
  fullTextWeight: number,
  semanticWeight: number,
  limit: number,
): Promise<HybridSearchResult[]> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      source_type: string;
      id: string;
      title: string;
      content: string;
      slug: string;
      combined_score: number;
    }>(`SELECT * FROM elongoat.hybrid_search($1, $2::vector, $3, $4, $5)`, [
      query,
      formatEmbeddingForPg(embedding),
      fullTextWeight,
      semanticWeight,
      limit,
    ]);

    return result.rows.map((row) => {
      const source = row.source_type as RagSource;
      const url =
        source === "paa"
          ? `${SITE_URL}/q/${row.slug}`
          : `${SITE_URL}/${row.slug}`;

      return {
        title: row.title,
        content: row.content,
        source,
        source_priority: SOURCE_WEIGHTS[source] || 1,
        relevance_score: row.combined_score,
        url,
        slug: row.slug,
      };
    });
  } catch (error) {
    console.error("[Hybrid Search] Database query error:", error);
    return [];
  }
}

/**
 * Main hybrid search function
 *
 * Automatically falls back to full-text only if embeddings are not available.
 */
export async function hybridSearch(
  options: HybridSearchOptions,
): Promise<HybridSearchResponse> {
  const {
    query,
    sources = ["content_cache", "paa", "cluster"],
    limit = 10,
    minScore = 0.01,
    useVectorSearch = true,
    fullTextWeight = DEFAULT_FULL_TEXT_WEIGHT,
    semanticWeight = DEFAULT_SEMANTIC_WEIGHT,
  } = options;

  const startTime = performance.now();

  // Check if vector search is available and requested
  const vectorEnabled = isEmbeddingEnabled() && useVectorSearch;

  // If vector search is not available, fall back to regular full-text search
  if (!vectorEnabled) {
    const fallbackResult = await ragSearch({
      query,
      sources,
      limit,
      minScore,
    });

    return {
      ...fallbackResult,
      results: fallbackResult.results.map((r) => ({
        ...r,
        full_text_score: r.relevance_score,
      })),
      metadata: {
        ...fallbackResult.metadata,
        search_mode: "full_text_only",
        vector_enabled: false,
      },
    };
  }

  // Generate embedding for the query
  const embeddingResult = await generateEmbedding(query);

  if (!embeddingResult) {
    console.warn(
      "[Hybrid Search] Failed to generate query embedding, falling back to full-text",
    );

    const fallbackResult = await ragSearch({
      query,
      sources,
      limit,
      minScore,
    });

    return {
      ...fallbackResult,
      results: fallbackResult.results.map((r) => ({
        ...r,
        full_text_score: r.relevance_score,
      })),
      metadata: {
        ...fallbackResult.metadata,
        search_mode: "full_text_only",
        vector_enabled: false,
      },
    };
  }

  // Execute hybrid search
  const results = await executeHybridSearchQuery(
    query,
    embeddingResult.embedding,
    fullTextWeight,
    semanticWeight,
    limit * 2, // Get more results to filter
  );

  // Filter by sources if specified
  const filteredResults = results.filter((r) => sources.includes(r.source));

  // Filter by minimum score
  const scoredResults = filteredResults.filter(
    (r) => r.relevance_score >= minScore,
  );

  // Limit results
  const finalResults = scoredResults.slice(0, limit);

  // Calculate metadata
  const searchTimeMs = performance.now() - startTime;
  const contentCacheCount = finalResults.filter(
    (r) => r.source === "content_cache",
  ).length;
  const paaCount = finalResults.filter((r) => r.source === "paa").length;
  const clusterCount = finalResults.filter(
    (r) => r.source === "cluster",
  ).length;

  return {
    query,
    results: finalResults,
    metadata: {
      total_results: finalResults.length,
      content_cache_count: contentCacheCount,
      paa_count: paaCount,
      cluster_count: clusterCount,
      search_time_ms: Math.round(searchTimeMs * 100) / 100,
      source_weights: SOURCE_WEIGHTS,
      search_mode: "hybrid",
      vector_enabled: true,
    },
  };
}

/**
 * Get similar articles by embedding
 */
export async function getSimilarArticles(
  slug: string,
  limit: number = 5,
): Promise<HybridSearchResult[]> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    // Get the embedding for the source article
    const sourceResult = await pool.query<{ embedding: string }>(
      `SELECT embedding::text FROM elongoat.content_cache WHERE slug = $1`,
      [slug],
    );

    if (sourceResult.rows.length === 0 || !sourceResult.rows[0].embedding) {
      return [];
    }

    const sourceEmbedding = sourceResult.rows[0].embedding;

    // Find similar articles
    const result = await pool.query<{
      slug: string;
      kind: string;
      content_md: string;
      similarity: number;
    }>(
      `SELECT
        cc.slug,
        cc.kind,
        cc.content_md,
        1 - (cc.embedding <=> $1::vector) as similarity
      FROM elongoat.content_cache cc
      WHERE cc.slug != $2
        AND cc.embedding IS NOT NULL
        AND 1 - (cc.embedding <=> $1::vector) > 0.7
      ORDER BY cc.embedding <=> $1::vector
      LIMIT $3`,
      [sourceEmbedding, slug, limit],
    );

    return result.rows.map((row) => {
      const titleMatch = row.content_md.match(/^#\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1]
        : row.slug.replace(/-/g, " ").replace(/\//g, " - ");

      const url =
        row.kind === "paa"
          ? `${SITE_URL}/q/${row.slug}`
          : `${SITE_URL}/${row.slug}`;

      return {
        title: title.charAt(0).toUpperCase() + title.slice(1),
        content:
          row.content_md.slice(0, 200) +
          (row.content_md.length > 200 ? "..." : ""),
        source: "content_cache" as RagSource,
        source_priority: SOURCE_WEIGHTS.content_cache,
        relevance_score: row.similarity,
        vector_score: row.similarity,
        url,
        slug: row.slug,
      };
    });
  } catch (error) {
    console.error("[Similar Articles] Error:", error);
    return [];
  }
}

/**
 * Check if hybrid search is available (embeddings configured + DB function exists)
 */
export async function isHybridSearchAvailable(): Promise<boolean> {
  if (!isEmbeddingEnabled()) {
    return false;
  }

  const pool = getDbPool();
  if (!pool) {
    return false;
  }

  try {
    // Check if the hybrid_search function exists
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'elongoat' AND p.proname = 'hybrid_search'
      ) as exists`,
    );

    return result.rows[0]?.exists ?? false;
  } catch {
    return false;
  }
}
