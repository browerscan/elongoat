/**
 * RAG Multi-Source Search Engine
 *
 * Provides hybrid search across multiple data sources with configurable weights:
 * - content_cache (weight 1.5): AI-generated long-form content
 * - paa_tree (weight 1.0): Google People Also Ask Q&A data
 * - cluster_pages (weight 0.5): SEO site architecture/keywords
 *
 * Features:
 * - PostgreSQL full-text search with ranking
 * - Source filtering
 * - Deduplication (similarity > 90%)
 * - Weighted scoring
 */

import "server-only";

import { getDbPool } from "@/lib/db";
import { escapeLikePattern } from "@/lib/sqlSecurity";

// ============================================================================
// Types
// ============================================================================

export type RagSource = "content_cache" | "paa" | "cluster";

export interface RagSearchResult {
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
}

export interface RagSearchMetadata {
  total_results: number;
  content_cache_count: number;
  paa_count: number;
  cluster_count: number;
  search_time_ms: number;
  source_weights: {
    content_cache: number;
    paa: number;
    cluster: number;
  };
}

export interface RagSearchResponse {
  query: string;
  results: RagSearchResult[];
  metadata: RagSearchMetadata;
}

export interface RagSearchOptions {
  query: string;
  sources?: RagSource[];
  limit?: number;
  minScore?: number;
}

// ============================================================================
// Constants
// ============================================================================

export const SOURCE_WEIGHTS: Record<RagSource, number> = {
  content_cache: 1.5,
  paa: 1.0,
  cluster: 0.5,
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_MIN_SCORE = 0.01;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://elongoat.io";

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Search content_cache table for AI-generated articles
 */
async function searchContentCache(
  query: string,
  limit: number,
): Promise<RagSearchResult[]> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    // Escape LIKE special characters to prevent SQL injection
    const escapedQuery = escapeLikePattern(query);
    const result = await pool.query<{
      slug: string;
      kind: string;
      content_md: string;
      rank: number;
    }>(
      `
      SELECT
        slug,
        kind,
        content_md,
        ts_rank_cd(
          to_tsvector('english', content_md || ' ' || slug),
          plainto_tsquery('english', $1)
        ) as rank
      FROM elongoat.content_cache
      WHERE
        to_tsvector('english', content_md || ' ' || slug) @@ plainto_tsquery('english', $1)
        OR content_md ILIKE '%' || $2 || '%' ESCAPE '\\'
        OR slug ILIKE '%' || $2 || '%' ESCAPE '\\'
      ORDER BY rank DESC
      LIMIT $3
      `,
      [query, escapedQuery, limit],
    );

    return result.rows.map((row) => {
      // Extract title from first heading or slug
      const titleMatch = row.content_md.match(/^#\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1]
        : row.slug.replace(/-/g, " ").replace(/\//g, " - ");

      // Extract topic from slug (first part before /)
      const slugParts = row.slug.split("/");
      const topic =
        slugParts.length > 1 ? slugParts[0].replace(/-/g, " ") : undefined;

      // Count words
      const wordCount = row.content_md.split(/\s+/).length;

      // Build URL based on kind
      const url =
        row.kind === "paa"
          ? `${SITE_URL}/q/${row.slug}`
          : `${SITE_URL}/${row.slug}`;

      return {
        title: title.charAt(0).toUpperCase() + title.slice(1),
        content:
          row.content_md.slice(0, 500) +
          (row.content_md.length > 500 ? "..." : ""),
        source: "content_cache" as RagSource,
        source_priority: SOURCE_WEIGHTS.content_cache,
        relevance_score: row.rank * SOURCE_WEIGHTS.content_cache,
        topic: topic
          ? topic.charAt(0).toUpperCase() + topic.slice(1)
          : undefined,
        url,
        slug: row.slug,
        word_count: wordCount,
      };
    });
  } catch (error) {
    console.error("[RAG Search] Error searching content_cache:", error);
    return [];
  }
}

/**
 * Search paa_tree table for Q&A data
 */
async function searchPaaTree(
  query: string,
  limit: number,
): Promise<RagSearchResult[]> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    // Escape LIKE special characters to prevent SQL injection
    const escapedQuery = escapeLikePattern(query);
    const result = await pool.query<{
      question: string;
      answer: string | null;
      slug: string;
      volume: number;
      rank: number;
    }>(
      `
      SELECT
        question,
        answer,
        slug,
        volume,
        ts_rank_cd(
          to_tsvector('english', question || ' ' || coalesce(answer, '')),
          plainto_tsquery('english', $1)
        ) as rank
      FROM elongoat.paa_tree
      WHERE
        to_tsvector('english', question || ' ' || coalesce(answer, '')) @@ plainto_tsquery('english', $1)
        OR question ILIKE '%' || $2 || '%' ESCAPE '\\'
      ORDER BY rank DESC, volume DESC
      LIMIT $3
      `,
      [query, escapedQuery, limit],
    );

    return result.rows.map((row) => ({
      title: row.question,
      content: row.answer || "No answer available yet.",
      source: "paa" as RagSource,
      source_priority: SOURCE_WEIGHTS.paa,
      relevance_score: row.rank * SOURCE_WEIGHTS.paa,
      url: `${SITE_URL}/q/${row.slug}`,
      slug: row.slug,
      volume: row.volume,
    }));
  } catch (error) {
    console.error("[RAG Search] Error searching paa_tree:", error);
    return [];
  }
}

/**
 * Search cluster_pages table for site structure/keywords
 */
async function searchClusterPages(
  query: string,
  limit: number,
): Promise<RagSearchResult[]> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    // Escape LIKE special characters to prevent SQL injection
    const escapedQuery = escapeLikePattern(query);
    const result = await pool.query<{
      topic: string;
      page: string;
      slug: string;
      seed_keyword: string | null;
      max_volume: number;
      total_volume: number;
      rank: number;
    }>(
      `
      SELECT
        topic,
        page,
        slug,
        seed_keyword,
        max_volume,
        total_volume,
        ts_rank_cd(
          to_tsvector('english', topic || ' ' || page || ' ' || coalesce(seed_keyword, '')),
          plainto_tsquery('english', $1)
        ) as rank
      FROM elongoat.cluster_pages
      WHERE
        to_tsvector('english', topic || ' ' || page || ' ' || coalesce(seed_keyword, ''))
        @@ plainto_tsquery('english', $1)
        OR page ILIKE '%' || $2 || '%' ESCAPE '\\'
        OR seed_keyword ILIKE '%' || $2 || '%' ESCAPE '\\'
        OR topic ILIKE '%' || $2 || '%' ESCAPE '\\'
      ORDER BY rank DESC, max_volume DESC
      LIMIT $3
      `,
      [query, escapedQuery, limit],
    );

    return result.rows.map((row) => ({
      title: row.page,
      content: `Topic: ${row.topic}${row.seed_keyword ? `. Primary keyword: ${row.seed_keyword}` : ""}. Total search volume: ${row.total_volume.toLocaleString()}.`,
      source: "cluster" as RagSource,
      source_priority: SOURCE_WEIGHTS.cluster,
      relevance_score: row.rank * SOURCE_WEIGHTS.cluster,
      topic: row.topic,
      url: `${SITE_URL}/${row.slug}`,
      slug: row.slug,
      volume: row.max_volume,
    }));
  } catch (error) {
    console.error("[RAG Search] Error searching cluster_pages:", error);
    return [];
  }
}

/**
 * Calculate text similarity using Jaccard coefficient
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Deduplicate results by checking title similarity (>90%)
 */
function deduplicateResults(results: RagSearchResult[]): RagSearchResult[] {
  const deduplicated: RagSearchResult[] = [];

  for (const result of results) {
    // Check if similar result already exists
    const isDuplicate = deduplicated.some(
      (existing) => calculateSimilarity(existing.title, result.title) > 0.9,
    );

    if (!isDuplicate) {
      deduplicated.push(result);
    }
  }

  return deduplicated;
}

/**
 * Main RAG search function - searches across multiple sources
 */
export async function ragSearch(
  options: RagSearchOptions,
): Promise<RagSearchResponse> {
  const startTime = performance.now();
  const {
    query,
    sources = ["content_cache", "paa", "cluster"],
    limit = DEFAULT_LIMIT,
    minScore = DEFAULT_MIN_SCORE,
  } = options;

  const effectiveLimit = Math.min(limit, MAX_LIMIT);

  // Search each enabled source in parallel
  const searchPromises: Promise<RagSearchResult[]>[] = [];

  if (sources.includes("content_cache")) {
    searchPromises.push(searchContentCache(query, effectiveLimit));
  }

  if (sources.includes("paa")) {
    searchPromises.push(searchPaaTree(query, effectiveLimit));
  }

  if (sources.includes("cluster")) {
    searchPromises.push(searchClusterPages(query, effectiveLimit));
  }

  const searchResults = await Promise.allSettled(searchPromises);

  // Collect all results
  let allResults: RagSearchResult[] = [];
  for (const result of searchResults) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    }
  }

  // Filter by minimum score
  allResults = allResults.filter((r) => r.relevance_score >= minScore);

  // Sort by relevance score (descending)
  allResults.sort((a, b) => b.relevance_score - a.relevance_score);

  // Deduplicate
  const deduplicated = deduplicateResults(allResults);

  // Limit final results
  const finalResults = deduplicated.slice(0, effectiveLimit);

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
    },
  };
}

/**
 * Get article by slug from content_cache
 */
export async function getArticleBySlug(slug: string): Promise<{
  found: boolean;
  article?: {
    slug: string;
    kind: string;
    title: string;
    content: string;
    model?: string;
    word_count: number;
    generated_at: string;
    url: string;
  };
}> {
  const pool = getDbPool();
  if (!pool) return { found: false };

  try {
    const result = await pool.query<{
      slug: string;
      kind: string;
      content_md: string;
      model: string | null;
      generated_at: Date;
    }>(
      `
      SELECT slug, kind, content_md, model, generated_at
      FROM elongoat.content_cache
      WHERE slug = $1
      LIMIT 1
      `,
      [slug],
    );

    if (result.rows.length === 0) {
      return { found: false };
    }

    const row = result.rows[0];
    const titleMatch = row.content_md.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1]
      : row.slug.replace(/-/g, " ").replace(/\//g, " - ");

    const url =
      row.kind === "paa"
        ? `${SITE_URL}/q/${row.slug}`
        : `${SITE_URL}/${row.slug}`;

    return {
      found: true,
      article: {
        slug: row.slug,
        kind: row.kind,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        content: row.content_md,
        model: row.model || undefined,
        word_count: row.content_md.split(/\s+/).length,
        generated_at: row.generated_at.toISOString(),
        url,
      },
    };
  } catch (error) {
    console.error("[RAG] Error fetching article:", error);
    return { found: false };
  }
}

/**
 * Get RAG statistics
 */
export async function getRagStats(): Promise<{
  content_cache: { total: number; by_kind: Record<string, number> };
  paa_tree: { total: number; with_answers: number };
  cluster_pages: { total: number; total_keywords: number };
  topics: { count: number };
  last_updated: string | null;
}> {
  const pool = getDbPool();
  if (!pool) {
    return {
      content_cache: { total: 0, by_kind: {} },
      paa_tree: { total: 0, with_answers: 0 },
      cluster_pages: { total: 0, total_keywords: 0 },
      topics: { count: 0 },
      last_updated: null,
    };
  }

  try {
    // Run all stats queries in parallel
    const [contentStats, paaStats, clusterStats, topicStats, lastUpdated] =
      await Promise.all([
        // Content cache stats
        pool.query<{ kind: string; count: string }>(
          `SELECT kind, COUNT(*)::text as count FROM elongoat.content_cache GROUP BY kind`,
        ),
        // PAA stats
        pool.query<{ total: string; with_answers: string }>(
          `SELECT
            COUNT(*)::text as total,
            COUNT(CASE WHEN answer IS NOT NULL AND answer != '' THEN 1 END)::text as with_answers
          FROM elongoat.paa_tree`,
        ),
        // Cluster stats
        pool.query<{ pages: string; keywords: string }>(
          `SELECT
            (SELECT COUNT(*)::text FROM elongoat.cluster_pages) as pages,
            (SELECT COUNT(*)::text FROM elongoat.cluster_keywords) as keywords`,
        ),
        // Topic count
        pool.query<{ count: string }>(
          `SELECT COUNT(DISTINCT topic)::text as count FROM elongoat.cluster_pages`,
        ),
        // Last updated
        pool.query<{ last_updated: Date | null }>(
          `SELECT MAX(updated_at) as last_updated FROM elongoat.content_cache`,
        ),
      ]);

    // Build content cache stats by kind
    const byKind: Record<string, number> = {};
    let totalContent = 0;
    for (const row of contentStats.rows) {
      byKind[row.kind] = parseInt(row.count, 10);
      totalContent += parseInt(row.count, 10);
    }

    return {
      content_cache: {
        total: totalContent,
        by_kind: byKind,
      },
      paa_tree: {
        total: parseInt(paaStats.rows[0]?.total || "0", 10),
        with_answers: parseInt(paaStats.rows[0]?.with_answers || "0", 10),
      },
      cluster_pages: {
        total: parseInt(clusterStats.rows[0]?.pages || "0", 10),
        total_keywords: parseInt(clusterStats.rows[0]?.keywords || "0", 10),
      },
      topics: {
        count: parseInt(topicStats.rows[0]?.count || "0", 10),
      },
      last_updated: lastUpdated.rows[0]?.last_updated?.toISOString() || null,
    };
  } catch (error) {
    console.error("[RAG] Error fetching stats:", error);
    return {
      content_cache: { total: 0, by_kind: {} },
      paa_tree: { total: 0, with_answers: 0 },
      cluster_pages: { total: 0, total_keywords: 0 },
      topics: { count: 0 },
      last_updated: null,
    };
  }
}

/**
 * Get all topics with page counts
 */
export async function getTopicsList(): Promise<
  Array<{
    topic: string;
    slug: string;
    page_count: number;
    total_volume: number;
  }>
> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      topic: string;
      topic_slug: string;
      page_count: string;
      total_volume: string;
    }>(
      `
      SELECT
        topic,
        topic_slug,
        COUNT(*)::text as page_count,
        SUM(total_volume)::text as total_volume
      FROM elongoat.cluster_pages
      GROUP BY topic, topic_slug
      ORDER BY SUM(total_volume) DESC
      `,
    );

    return result.rows.map((row) => ({
      topic: row.topic,
      slug: row.topic_slug,
      page_count: parseInt(row.page_count, 10),
      total_volume: parseInt(row.total_volume, 10),
    }));
  } catch (error) {
    console.error("[RAG] Error fetching topics:", error);
    return [];
  }
}
