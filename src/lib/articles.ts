/**
 * Article Library - Read from content_cache database
 * Replaces JSON-based indexes.ts for article listing
 */
import "server-only";

import { getDbPool } from "./db";

// ============================================================================
// Types
// ============================================================================

export interface Article {
  slug: string;
  kind: string;
  title: string;
  snippet: string;
  wordCount: number;
  updatedAt: string;
  generatedAt: string;
  url: string;
}

export interface ArticleListResult {
  articles: Article[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ArticleDetail extends Article {
  contentMd: string;
  model: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract title from markdown content or slug
 * Skips generic headings like "TL;DR", falls back to slug parsing
 */
function extractTitle(contentMd: string | null, slug: string): string {
  // Skip headings that are generic/not useful as titles
  const skipHeadings = ["tl;dr", "tldr", "summary", "overview", "introduction"];

  if (contentMd) {
    // Try to find all H1 or H2 headings and pick a good one
    const headings = contentMd.match(/^#{1,2}\s+(.+?)$/gm) || [];
    for (const heading of headings) {
      const text = heading.replace(/^#{1,2}\s+/, "").trim();
      if (text && !skipHeadings.includes(text.toLowerCase())) {
        return text;
      }
    }
  }

  // Fallback: parse slug to generate a readable title
  // "elon-musk-ai/ai-quotes" -> "AI Quotes"
  // "x-formerly-twitter-updates/what-is-twitter-called-now" -> "What Is Twitter Called Now"
  const parts = slug.split("/");
  const pagePart = parts[parts.length - 1] || parts[0];
  return pagePart
    .split("-")
    .map((w) => {
      // Keep common acronyms uppercase
      if (["ai", "x", "ev", "ceo", "us", "uk"].includes(w.toLowerCase())) {
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Extract snippet from markdown content
 * Skips headings and gets first paragraph
 */
function extractSnippet(contentMd: string | null, maxLength = 200): string {
  if (!contentMd) return "";

  // Skip frontmatter if present
  let content = contentMd;
  if (content.startsWith("---")) {
    const endIndex = content.indexOf("---", 3);
    if (endIndex > 0) content = content.slice(endIndex + 3);
  }

  // Skip headings and find first paragraph
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("|") &&
      trimmed.length > 50
    ) {
      // Clean markdown syntax
      const cleaned = trimmed
        .replace(/\*\*(.+?)\*\*/g, "$1") // bold
        .replace(/\*(.+?)\*/g, "$1") // italic
        .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
        .replace(/`(.+?)`/g, "$1"); // code

      return cleaned.length > maxLength
        ? cleaned.slice(0, maxLength) + "..."
        : cleaned;
    }
  }

  return "";
}

/**
 * Count words in markdown content
 */
function countWords(contentMd: string | null): number {
  if (!contentMd) return 0;
  // Remove markdown syntax and count words
  const text = contentMd
    .replace(/#+\s/g, "") // headings
    .replace(/\*\*?/g, "") // bold/italic
    .replace(/\[.+?\]\(.+?\)/g, "") // links
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, "") // code blocks
    .replace(/\|.+\|/g, "") // tables
    .trim();

  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Estimate word count from a truncated sample and full length.
 * This avoids undercounting when list queries only fetch a snippet.
 */
function estimateWordCountFromLength(
  contentSample: string | null,
  contentLength?: number | null,
): number {
  if (!contentLength || contentLength <= 0) {
    return countWords(contentSample);
  }

  if (contentSample) {
    const sampleLength = contentSample.length;
    const sampleWords = countWords(contentSample);
    if (sampleLength > 0 && sampleWords > 0) {
      const ratio = contentLength / sampleLength;
      return Math.max(1, Math.round(sampleWords * ratio));
    }
  }

  // Fallback heuristic: average ~5.5 chars per word including spaces.
  return Math.max(1, Math.round(contentLength / 5.5));
}

/**
 * Build URL from slug and kind
 */
function buildUrl(slug: string, kind: string): string {
  if (kind === "paa" || kind === "paa_question") {
    // PAA questions go to /q/[slug]
    const questionSlug = slug.includes("/") ? slug.split("/")[1] : slug;
    return `/q/${questionSlug}`;
  }
  // Cluster pages go to /[topic]/[page]
  return `/${slug}`;
}

// ============================================================================
// Database Queries
// ============================================================================

/**
 * List articles from content_cache with pagination
 */
export async function listArticles(params: {
  kind?: "cluster" | "paa" | null;
  sort?: "updated" | "title";
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<ArticleListResult> {
  const pool = getDbPool();
  if (!pool) {
    return {
      articles: [],
      pagination: { total: 0, limit: 0, offset: 0, hasMore: false },
    };
  }

  const {
    kind = null,
    sort = "updated",
    limit = 24,
    offset = 0,
    search = null,
  } = params;

  try {
    // Build WHERE conditions
    const conditions: string[] = [
      "(expires_at IS NULL OR expires_at > NOW())",
      "content_md IS NOT NULL",
      "LENGTH(content_md) > 500",
    ];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (kind) {
      conditions.push(`kind = $${paramIndex}`);
      values.push(kind);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `to_tsvector('english', content_md || ' ' || slug) @@ plainto_tsquery('english', $${paramIndex})`,
      );
      values.push(search);
      paramIndex++;
    }

    // Count total
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM elongoat.content_cache WHERE ${conditions.join(" AND ")}`,
      values,
    );
    const total = parseInt(countResult.rows[0]?.count || "0", 10);

    // Add sorting
    const orderBy =
      sort === "title" ? "slug ASC" : "COALESCE(updated_at, generated_at) DESC";

    // Add pagination params
    values.push(Math.min(limit, 100), offset);

    // Fetch articles
    const result = await pool.query<{
      slug: string;
      kind: string;
      content_md: string;
      content_length: number;
      updated_at: Date | null;
      generated_at: Date;
    }>(
      `
      SELECT
        slug,
        kind,
        LEFT(content_md, 1000) as content_md,
        LENGTH(content_md) as content_length,
        updated_at,
        generated_at
      FROM elongoat.content_cache
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values,
    );

    const articles: Article[] = result.rows.map((row) => ({
      slug: row.slug,
      kind: row.kind,
      title: extractTitle(row.content_md, row.slug),
      snippet: extractSnippet(row.content_md),
      wordCount: estimateWordCountFromLength(
        row.content_md,
        row.content_length,
      ),
      updatedAt: (row.updated_at || row.generated_at).toISOString(),
      generatedAt: row.generated_at.toISOString(),
      url: buildUrl(row.slug, row.kind),
    }));

    return {
      articles,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + articles.length < total,
      },
    };
  } catch (error) {
    console.error("[articles] List error:", error);
    return {
      articles: [],
      pagination: { total: 0, limit: 0, offset: 0, hasMore: false },
    };
  }
}

/**
 * Get featured articles for homepage
 */
export async function getFeaturedArticles(limit = 8): Promise<Article[]> {
  const result = await listArticles({ limit, sort: "updated" });
  return result.articles;
}

/**
 * Get article count
 */
export async function getArticleCount(): Promise<number> {
  const pool = getDbPool();
  if (!pool) return 0;

  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM elongoat.content_cache
       WHERE (expires_at IS NULL OR expires_at > NOW())
         AND content_md IS NOT NULL
         AND LENGTH(content_md) > 500`,
    );
    return parseInt(result.rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("[articles] Count error:", error);
    return 0;
  }
}

/**
 * Get full article detail by slug
 */
export async function getArticleBySlug(
  slug: string,
): Promise<ArticleDetail | null> {
  const pool = getDbPool();
  if (!pool) return null;

  try {
    const result = await pool.query<{
      slug: string;
      kind: string;
      content_md: string;
      model: string | null;
      updated_at: Date | null;
      generated_at: Date;
    }>(
      `SELECT slug, kind, content_md, model, updated_at, generated_at
       FROM elongoat.content_cache
       WHERE slug = $1
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [slug],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      slug: row.slug,
      kind: row.kind,
      title: extractTitle(row.content_md, row.slug),
      snippet: extractSnippet(row.content_md),
      wordCount: countWords(row.content_md),
      updatedAt: (row.updated_at || row.generated_at).toISOString(),
      generatedAt: row.generated_at.toISOString(),
      url: buildUrl(row.slug, row.kind),
      contentMd: row.content_md,
      model: row.model,
    };
  } catch (error) {
    console.error("[articles] GetBySlug error:", error);
    return null;
  }
}

/**
 * Find related tweets for an article (by keywords from slug)
 */
export async function findRelatedTweetsForArticle(params: {
  slug: string;
  limit?: number;
}): Promise<
  Array<{
    tweetId: string;
    fullText: string;
    likeCount: number;
    createdAt: string;
    url: string;
  }>
> {
  const pool = getDbPool();
  if (!pool) return [];

  const { slug, limit = 5 } = params;

  try {
    // Extract keywords from slug
    const keywords = slug
      .replace(/[/-]/g, " ")
      .split(" ")
      .filter((w) => w.length > 2)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    const searchQuery = keywords.join(" | ");

    const result = await pool.query<{
      tweet_id: string;
      full_text: string;
      like_count: number;
      created_at: Date;
      twitter_url: string | null;
    }>(
      `
      SELECT tweet_id, full_text, like_count, created_at, twitter_url
      FROM elongoat.musk_tweets
      WHERE search_vector @@ to_tsquery('english', $1)
        AND is_retweet = FALSE
        AND length(full_text) > 80
      ORDER BY like_count DESC
      LIMIT $2
      `,
      [searchQuery, limit],
    );

    return result.rows.map((row) => ({
      tweetId: row.tweet_id,
      fullText: row.full_text,
      likeCount: row.like_count,
      createdAt: row.created_at.toISOString(),
      url: row.twitter_url || `https://x.com/elonmusk/status/${row.tweet_id}`,
    }));
  } catch (error) {
    console.error("[articles] FindRelatedTweets error:", error);
    return [];
  }
}

/**
 * Find related articles for a tweet
 */
export async function findRelatedArticlesForTweet(params: {
  fullText: string;
  limit?: number;
}): Promise<Article[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const { fullText, limit = 5 } = params;

  try {
    // Truncate tweet text for search
    const searchText = fullText.slice(0, 200);

    const result = await pool.query<{
      slug: string;
      kind: string;
      content_md: string;
      updated_at: Date | null;
      generated_at: Date;
    }>(
      `
      SELECT slug, kind, LEFT(content_md, 1000) as content_md, updated_at, generated_at
      FROM elongoat.content_cache
      WHERE to_tsvector('english', content_md || ' ' || slug)
        @@ plainto_tsquery('english', $1)
        AND (expires_at IS NULL OR expires_at > NOW())
        AND content_md IS NOT NULL
      ORDER BY ts_rank_cd(
        to_tsvector('english', content_md || ' ' || slug),
        plainto_tsquery('english', $1)
      ) DESC
      LIMIT $2
      `,
      [searchText, limit],
    );

    return result.rows.map((row) => ({
      slug: row.slug,
      kind: row.kind,
      title: extractTitle(row.content_md, row.slug),
      snippet: extractSnippet(row.content_md),
      wordCount: countWords(row.content_md),
      updatedAt: (row.updated_at || row.generated_at).toISOString(),
      generatedAt: row.generated_at.toISOString(),
      url: buildUrl(row.slug, row.kind),
    }));
  } catch (error) {
    console.error("[articles] FindRelatedArticles error:", error);
    return [];
  }
}
