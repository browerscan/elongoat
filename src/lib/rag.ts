// RAG is server-only by nature (DB access)
import { getDbPool } from "./db";
import { escapeLikePattern } from "./sqlSecurity";
import { getTweetsForRag } from "./muskTweets";
import { buildSerpRagContext as fetchSerpContext } from "./proxyGrid";
import {
  generateEmbedding,
  isEmbeddingEnabled,
  prepareTextForEmbedding,
} from "./embeddings";

export type RagContext = {
  source:
    | "paa"
    | "cluster"
    | "content_cache"
    | "tweet"
    | "serp"
    | "web_enrichment"
    | "youtube_enrichment"
    | "serp_enrichment";
  weight: number;
  question?: string;
  answer?: string;
  title?: string;
  snippet?: string;
  volume?: number;
  // Tweet-specific fields
  tweetUrl?: string;
  tweetLikes?: number;
  tweetDate?: string;
  // SERP-specific fields
  serpQuery?: string;
  topResults?: Array<{ title: string; url: string; snippet: string }>;
  peopleAlsoAsk?: Array<{ question: string; snippet?: string }>;
  relatedSearches?: string[];
  // Web enrichment fields
  url?: string;
  // YouTube enrichment fields
  videoId?: string;
  channel?: string;
  // Hybrid search scores
  textRank?: number;
  vectorSimilarity?: number;
  combinedScore?: number;
};

export type RagResult = {
  contexts: RagContext[];
  totalWeight: number;
};

// ============================================================================
// Hybrid Search Configuration
// ============================================================================

export interface HybridSearchConfig {
  fullTextWeight: number;
  vectorWeight: number;
  matchThreshold: number;
  enableFallback: boolean;
}

const DEFAULT_HYBRID_CONFIG: HybridSearchConfig = {
  fullTextWeight: 0.4,
  vectorWeight: 0.6,
  matchThreshold: 0.5,
  enableFallback: true,
};

/**
 * Search PAA tree for relevant questions/answers using text similarity
 * Simple approach: keyword matching with PostgreSQL full-text search
 */
export async function searchPaaContext(params: {
  query: string;
  limit?: number;
}): Promise<RagContext[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const limit = params.limit ?? 10;

  try {
    // Escape LIKE special characters to prevent SQL injection
    const escapedQuery = escapeLikePattern(params.query);
    // Use both full-text search and ILIKE for better recall
    const result = await pool.query<{
      question: string;
      answer: string | null;
      volume: number;
      rank: number;
    }>(
      `
      SELECT
        question,
        answer,
        volume,
        ts_rank(to_tsvector('english', question || ' ' || coalesce(answer, '')),
                plainto_tsquery('english', $1)) as rank
      FROM elongoat.paa_tree
      WHERE
        to_tsvector('english', question || ' ' || coalesce(answer, '')) @@ plainto_tsquery('english', $1)
        OR question ILIKE '%' || $2 || '%' ESCAPE '\\'
      ORDER BY rank DESC, volume DESC
      LIMIT $3
      `,
      [params.query, escapedQuery, limit],
    );

    return result.rows.map((row) => ({
      source: "paa" as const,
      weight: 0.6,
      question: row.question,
      answer: row.answer ?? undefined,
      volume: row.volume,
    }));
  } catch (error) {
    console.error("[rag] Error searching PAA:", error);
    return [];
  }
}

/**
 * Search existing content cache for similar topics
 */
export async function searchContentCache(params: {
  query: string;
  kind?: string;
  limit?: number;
}): Promise<RagContext[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const limit = params.limit ?? 5;

  try {
    const conditions = [
      "to_tsvector('english', content_md || ' ' || slug) @@ plainto_tsquery('english', $1)",
    ];
    const values: unknown[] = [params.query, limit];

    if (params.kind) {
      conditions.push("kind = $3");
      values.push(params.kind);
    }

    const result = await pool.query<{
      slug: string;
      content_md: string;
      kind: string;
    }>(
      `
      SELECT slug, content_md, kind
      FROM elongoat.content_cache
      WHERE ${conditions.join(" AND ")}
      ORDER BY generated_at DESC
      LIMIT $2
      `,
      values,
    );

    return result.rows.map((row) => ({
      source: "content_cache" as const,
      weight: 1.0,
      title: row.slug,
      snippet: row.content_md.slice(0, 500),
    }));
  } catch (error) {
    console.error("[rag] Error searching content cache:", error);
    return [];
  }
}

/**
 * Search cluster keywords for related topics
 */
export async function searchClusterContext(params: {
  query: string;
  limit?: number;
}): Promise<RagContext[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const limit = params.limit ?? 5;

  try {
    // Escape LIKE special characters to prevent SQL injection
    const escapedQuery = escapeLikePattern(params.query);
    const result = await pool.query<{
      topic: string;
      page: string;
      seed_keyword: string | null;
      max_volume: number;
    }>(
      `
      SELECT DISTINCT topic, page, seed_keyword, max_volume
      FROM elongoat.cluster_pages
      WHERE
        to_tsvector('english', topic || ' ' || page || ' ' || coalesce(seed_keyword, ''))
        @@ plainto_tsquery('english', $1)
        OR page ILIKE '%' || $2 || '%' ESCAPE '\\'
        OR seed_keyword ILIKE '%' || $2 || '%' ESCAPE '\\'
      ORDER BY max_volume DESC
      LIMIT $3
      `,
      [params.query, escapedQuery, limit],
    );

    return result.rows.map((row) => ({
      source: "cluster" as const,
      weight: 0.3,
      title: row.page,
      snippet: `Topic: ${row.topic}${row.seed_keyword ? ` | Seed: ${row.seed_keyword}` : ""}`,
      volume: row.max_volume,
    }));
  } catch (error) {
    console.error("[rag] Error searching clusters:", error);
    return [];
  }
}

/**
 * Search Elon Musk's tweets for relevant content
 * Highest priority source - first-person authentic content
 * Uses hybrid search (full-text + vector) when embeddings are available
 */
export async function searchTweetContext(params: {
  query: string;
  limit?: number;
  useHybrid?: boolean;
  fullTextWeight?: number;
  vectorWeight?: number;
}): Promise<RagContext[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const limit = params.limit ?? 5;
  const useHybrid = params.useHybrid !== false && isEmbeddingEnabled();

  try {
    if (useHybrid) {
      // Try hybrid search with vector similarity
      const queryEmbedding = await generateEmbedding(
        prepareTextForEmbedding(params.query),
      );

      if (queryEmbedding) {
        const ftWeight = params.fullTextWeight ?? 0.3;
        const vecWeight = params.vectorWeight ?? 0.7;

        const result = await pool.query<{
          tweet_id: string;
          full_text: string;
          url: string;
          like_count: number;
          created_at: Date;
          combined_score: number;
          text_rank: number;
          vector_similarity: number;
        }>(
          `
          SELECT * FROM elongoat.search_tweets_hybrid(
            $1::text,
            $2::vector,
            $3::float,
            $4::float,
            $5::int,
            0,
            true,
            true
          )
          `,
          [
            params.query,
            `[${queryEmbedding.embedding.join(",")}]`,
            ftWeight,
            vecWeight,
            limit,
          ],
        );

        return result.rows.map((row) => ({
          source: "tweet" as const,
          weight: 0.9,
          snippet: row.full_text,
          tweetUrl: row.url || "",
          tweetLikes: row.like_count,
          tweetDate: row.created_at.toISOString().split("T")[0],
          textRank: row.text_rank,
          vectorSimilarity: row.vector_similarity ?? undefined,
          combinedScore: row.combined_score,
        }));
      }
    }

    // Fallback to full-text search only
    const tweets = await getTweetsForRag({
      query: params.query,
      limit,
    });

    return tweets.map((tweet) => ({
      source: "tweet" as const,
      weight: 0.9,
      snippet: tweet.text,
      tweetUrl: tweet.url,
      tweetLikes: tweet.likes,
      tweetDate: tweet.date,
      textRank: tweet.rank,
    }));
  } catch (error) {
    console.error("[rag] Error searching tweets:", error);
    return [];
  }
}

/**
 * Search live Google SERP for real-time context
 * Provides up-to-date search results, PAA, and related searches
 */
export async function searchSerpContext(params: {
  query: string;
  limit?: number;
}): Promise<RagContext[]> {
  try {
    const serpData = await fetchSerpContext(params.query, { useCache: true });
    if (!serpData) return [];

    const contexts: RagContext[] = [];

    // Add top results as individual contexts
    for (const result of serpData.topResults.slice(0, params.limit ?? 5)) {
      contexts.push({
        source: "serp",
        weight: 0.7,
        title: result.title,
        snippet: result.snippet,
        serpQuery: params.query,
        topResults: [
          { title: result.title, url: result.link, snippet: result.snippet },
        ],
      });
    }

    // Add a single aggregated context with PAA and related searches
    if (
      serpData.peopleAlsoAsk.length > 0 ||
      serpData.relatedSearches.length > 0
    ) {
      contexts.push({
        source: "serp",
        weight: 0.7,
        serpQuery: params.query,
        topResults: serpData.topResults.slice(0, 3).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
        })),
        peopleAlsoAsk: serpData.peopleAlsoAsk.slice(0, 5),
        relatedSearches: serpData.relatedSearches.slice(0, 8),
      });
    }

    return contexts;
  } catch (error) {
    console.error("[rag] Error searching SERP:", error);
    return [];
  }
}

/**
 * Search enriched web content from external sources
 * Uses web2md API to fetch and convert external pages to markdown
 */
export async function searchEnrichedWebContext(params: {
  urls: string[];
  limit?: number;
}): Promise<RagContext[]> {
  const { enrichFromWeb, webContentToRagContext } =
    await import("./contentEnrichment");

  try {
    const enrichedContents = await Promise.allSettled(
      params.urls.slice(0, params.limit ?? 3).map((url) => enrichFromWeb(url)),
    );

    const contexts: RagContext[] = [];
    for (const result of enrichedContents) {
      if (result.status === "fulfilled" && result.value) {
        contexts.push(webContentToRagContext(result.value));
      }
    }

    return contexts;
  } catch (error) {
    console.error("[rag] Error searching enriched web content:", error);
    return [];
  }
}

/**
 * Search enriched YouTube content (video info and transcripts)
 * Uses YouTube API to fetch video metadata and transcripts
 */
export async function searchEnrichedYouTubeContext(params: {
  videoIds: string[];
  limit?: number;
}): Promise<RagContext[]> {
  const { enrichFromYouTube, youtubeContentToRagContext } =
    await import("./contentEnrichment");

  try {
    const enrichedContents = await Promise.allSettled(
      params.videoIds
        .slice(0, params.limit ?? 3)
        .map((id) => enrichFromYouTube(id)),
    );

    const contexts: RagContext[] = [];
    for (const result of enrichedContents) {
      if (result.status === "fulfilled" && result.value) {
        contexts.push(youtubeContentToRagContext(result.value));
      }
    }

    return contexts;
  } catch (error) {
    console.error("[rag] Error searching enriched YouTube content:", error);
    return [];
  }
}

/**
 * Helper: timeout promiseWrapper
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallbackValue: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

/**
 * Build comprehensive RAG context from multiple sources
 */
export async function buildRagContext(params: {
  query: string;
  includeContentCache?: boolean;
  includePaa?: boolean;
  includeClusters?: boolean;
  includeTweets?: boolean;
  includeSerp?: boolean;
  includeEnrichedWeb?: boolean;
  includeEnrichedYouTube?: boolean;
  enrichedWebUrls?: string[];
  enrichedYouTubeIds?: string[];
}): Promise<RagResult> {
  const {
    includeContentCache = true,
    includePaa = true,
    includeClusters = true,
    includeTweets = true,
    includeSerp = true,
    includeEnrichedWeb = false,
    includeEnrichedYouTube = false,
    enrichedWebUrls = [],
    enrichedYouTubeIds = [],
  } = params;

  const contexts: RagContext[] = [];

  // Fetch all sources in parallel with timeouts
  const promises: Promise<RagContext[]>[] = [];

  // Tweets first - highest priority authentic content (1500ms timeout)
  if (includeTweets) {
    promises.push(
      withTimeout(
        searchTweetContext({ query: params.query, limit: 5 }),
        1500,
        [],
      ),
    );
  }

  // PAA (1000ms timeout)
  if (includePaa) {
    promises.push(
      withTimeout(
        searchPaaContext({ query: params.query, limit: 8 }),
        1000,
        [],
      ),
    );
  }

  // Content Cache (500ms timeout - usually fast)
  if (includeContentCache) {
    promises.push(
      withTimeout(
        searchContentCache({ query: params.query, limit: 3 }),
        500,
        [],
      ),
    );
  }

  // Clusters (800ms timeout)
  if (includeClusters) {
    promises.push(
      withTimeout(
        searchClusterContext({ query: params.query, limit: 5 }),
        800,
        [],
      ),
    );
  }

  // SERP (3000ms timeout - external API)
  if (includeSerp) {
    promises.push(
      withTimeout(
        searchSerpContext({ query: params.query, limit: 5 }),
        3000,
        [],
      ),
    );
  }

  // Enriched Web Content (10000ms timeout - external web2md API)
  if (includeEnrichedWeb && enrichedWebUrls.length > 0) {
    promises.push(
      withTimeout(
        searchEnrichedWebContext({ urls: enrichedWebUrls, limit: 3 }),
        10000,
        [],
      ),
    );
  }

  // Enriched YouTube Content (10000ms timeout - external YouTube API)
  if (includeEnrichedYouTube && enrichedYouTubeIds.length > 0) {
    promises.push(
      withTimeout(
        searchEnrichedYouTubeContext({
          videoIds: enrichedYouTubeIds,
          limit: 3,
        }),
        10000,
        [],
      ),
    );
  }

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      contexts.push(...result.value);
    }
  }

  // Calculate total weight
  const totalWeight = contexts.reduce((sum, ctx) => sum + ctx.weight, 0);

  return { contexts, totalWeight };
}

/**
 * Format RAG contexts into a prompt-ready string
 */
export function formatRagContexts(contexts: RagContext[]): string {
  if (contexts.length === 0) {
    return "No additional context available.";
  }

  const sections: string[] = [];

  // Group by source
  const tweetContexts = contexts.filter((c) => c.source === "tweet");
  const paaContexts = contexts.filter((c) => c.source === "paa");
  const cacheContexts = contexts.filter((c) => c.source === "content_cache");
  const clusterContexts = contexts.filter((c) => c.source === "cluster");
  const serpContexts = contexts.filter((c) => c.source === "serp");
  const webEnrichmentContexts = contexts.filter(
    (c) => c.source === "web_enrichment",
  );
  const youtubeEnrichmentContexts = contexts.filter(
    (c) => c.source === "youtube_enrichment",
  );

  // Tweets first - authentic first-person content (highest priority)
  if (tweetContexts.length > 0) {
    sections.push("### My actual tweets on this topic:");
    for (const ctx of tweetContexts.slice(0, 5)) {
      if (ctx.snippet) {
        const likes = ctx.tweetLikes
          ? ` (${ctx.tweetLikes.toLocaleString()} likes)`
          : "";
        const date = ctx.tweetDate ? ` [${ctx.tweetDate}]` : "";
        sections.push(`\n> "${ctx.snippet}"${likes}${date}`);
      }
    }
  }

  // Web enrichment - external content sources
  if (webEnrichmentContexts.length > 0) {
    sections.push("\n### External References:");
    for (const ctx of webEnrichmentContexts.slice(0, 3)) {
      sections.push(`\n**${ctx.title}**`);
      if (ctx.url) {
        sections.push(`Source: ${ctx.url}`);
      }
      if (ctx.snippet) {
        sections.push(`\n${ctx.snippet.slice(0, 500)}...`);
      }
    }
  }

  // YouTube enrichment - video transcripts and info
  if (youtubeEnrichmentContexts.length > 0) {
    sections.push("\n### Video References:");
    for (const ctx of youtubeEnrichmentContexts.slice(0, 2)) {
      sections.push(`\n**${ctx.title}**`);
      if (ctx.channel) {
        sections.push(`Channel: ${ctx.channel}`);
      }
      if (ctx.videoId) {
        sections.push(`https://youtube.com/watch?v=${ctx.videoId}`);
      }
      if (ctx.snippet) {
        sections.push(`\n${ctx.snippet.slice(0, 500)}...`);
      }
    }
  }

  // SERP data - live Google search results
  if (serpContexts.length > 0) {
    const serpCtx = serpContexts[0]; // Use the aggregated context
    if (serpCtx.peopleAlsoAsk && serpCtx.peopleAlsoAsk.length > 0) {
      sections.push("\n### Live Google - People Also Ask:");
      for (const paa of serpCtx.peopleAlsoAsk.slice(0, 5)) {
        sections.push(`- **${paa.question}**`);
        if (paa.snippet) {
          sections.push(`  ${paa.snippet.slice(0, 200)}...`);
        }
      }
    }
    if (serpCtx.relatedSearches && serpCtx.relatedSearches.length > 0) {
      sections.push("\n### Live Google - Related Searches:");
      for (const search of serpCtx.relatedSearches.slice(0, 6)) {
        sections.push(`- ${search}`);
      }
    }
    if (serpCtx.topResults && serpCtx.topResults.length > 0) {
      sections.push("\n### Top Ranking Pages:");
      for (const result of serpCtx.topResults.slice(0, 3)) {
        sections.push(`- **${result.title}**`);
        sections.push(`  ${result.snippet.slice(0, 150)}...`);
      }
    }
  }

  if (paaContexts.length > 0) {
    sections.push("\n### Related Q&A (from Google PAA data):");
    for (const ctx of paaContexts.slice(0, 5)) {
      sections.push(`\n**Q: ${ctx.question}**`);
      if (ctx.answer) {
        sections.push(
          `A: ${ctx.answer.slice(0, 300)}${ctx.answer.length > 300 ? "..." : ""}`,
        );
      }
      if (ctx.volume) {
        sections.push(`(Search volume: ${ctx.volume})`);
      }
    }
  }

  if (cacheContexts.length > 0) {
    sections.push("\n### Previously Generated Content:");
    for (const ctx of cacheContexts.slice(0, 3)) {
      sections.push(`\n**${ctx.title}**`);
      if (ctx.snippet) {
        sections.push(ctx.snippet);
      }
    }
  }

  if (clusterContexts.length > 0) {
    sections.push("\n### Related Topics:");
    for (const ctx of clusterContexts.slice(0, 5)) {
      sections.push(`- ${ctx.title} (${ctx.snippet})`);
    }
  }

  return sections.join("\n");
}

// ============================================================================
// Hybrid Search Functions
// ============================================================================

/**
 * Perform hybrid search across all sources with vector similarity
 * Combines full-text search rankings with vector embeddings for semantic relevance
 */
export async function hybridSearch(params: {
  query: string;
  sources?: Array<"content_cache" | "paa" | "cluster" | "tweet">;
  config?: Partial<HybridSearchConfig>;
  limit?: number;
}): Promise<RagResult> {
  const pool = getDbPool();
  if (!pool) {
    // Fallback to regular RAG if no DB
    return buildRagContext({
      query: params.query,
      includeTweets: params.sources?.includes("tweet") ?? true,
      includePaa: params.sources?.includes("paa") ?? true,
      includeContentCache: params.sources?.includes("content_cache") ?? true,
      includeClusters: params.sources?.includes("cluster") ?? true,
      includeSerp: false,
    });
  }

  const config = { ...DEFAULT_HYBRID_CONFIG, ...params.config };
  const limit = params.limit ?? 10;
  const sources = params.sources ?? [
    "content_cache",
    "paa",
    "cluster",
    "tweet",
  ];

  const contexts: RagContext[] = [];

  // Generate query embedding once for all vector searches
  let queryEmbedding: number[] | null = null;
  if (isEmbeddingEnabled()) {
    const result = await generateEmbedding(
      prepareTextForEmbedding(params.query),
    );
    if (result) {
      queryEmbedding = result.embedding;
    }
  }

  // Search each source that has embeddings
  if (sources.includes("content_cache") && queryEmbedding) {
    try {
      const result = await pool.query<{
        slug: string;
        content_md: string;
        kind: string;
        similarity: number;
      }>(
        `
        SELECT
          slug,
          LEFT(content_md, 500) as content_md,
          kind,
          1 - (embedding <=> $1::vector) as similarity
        FROM elongoat.content_cache
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [`[${queryEmbedding.join(",")}]`, config.matchThreshold, limit],
      );

      for (const row of result.rows) {
        contexts.push({
          source: "content_cache",
          weight: 1.0,
          title: row.slug,
          snippet: row.content_md,
          vectorSimilarity: row.similarity,
        });
      }
    } catch (e) {
      console.error("[hybridSearch] Content cache error:", e);
    }
  }

  if (sources.includes("paa") && queryEmbedding) {
    try {
      const result = await pool.query<{
        question: string;
        answer: string;
        volume: number;
        similarity: number;
      }>(
        `
        SELECT
          question,
          answer,
          volume,
          1 - (embedding <=> $1::vector) as similarity
        FROM elongoat.paa_tree
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [`[${queryEmbedding.join(",")}]`, config.matchThreshold, limit],
      );

      for (const row of result.rows) {
        contexts.push({
          source: "paa",
          weight: 0.6,
          question: row.question,
          answer: row.answer ?? undefined,
          volume: row.volume,
          vectorSimilarity: row.similarity,
        });
      }
    } catch (e) {
      console.error("[hybridSearch] PAA error:", e);
    }
  }

  if (sources.includes("cluster") && queryEmbedding) {
    try {
      const result = await pool.query<{
        topic: string;
        page: string;
        seed_keyword: string;
        max_volume: number;
        similarity: number;
      }>(
        `
        SELECT
          topic,
          page,
          seed_keyword,
          max_volume,
          1 - (embedding <=> $1::vector) as similarity
        FROM elongoat.cluster_pages
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [`[${queryEmbedding.join(",")}]`, config.matchThreshold, limit],
      );

      for (const row of result.rows) {
        contexts.push({
          source: "cluster",
          weight: 0.3,
          title: row.page,
          snippet: `Topic: ${row.topic}${row.seed_keyword ? ` | Seed: ${row.seed_keyword}` : ""}`,
          volume: row.max_volume,
          vectorSimilarity: row.similarity,
        });
      }
    } catch (e) {
      console.error("[hybridSearch] Cluster error:", e);
    }
  }

  // Tweets use the dedicated hybrid function
  if (sources.includes("tweet")) {
    const tweetResults = await searchTweetContext({
      query: params.query,
      limit,
      useHybrid: queryEmbedding !== null,
      fullTextWeight: config.fullTextWeight,
      vectorWeight: config.vectorWeight,
    });
    contexts.push(...tweetResults);
  }

  // Sort by combined score if available, otherwise by vector similarity
  contexts.sort((a, b) => {
    if (a.combinedScore !== undefined && b.combinedScore !== undefined) {
      return b.combinedScore - a.combinedScore;
    }
    if (a.vectorSimilarity !== undefined && b.vectorSimilarity !== undefined) {
      return b.vectorSimilarity - a.vectorSimilarity;
    }
    return b.weight - a.weight;
  });

  const totalWeight = contexts.reduce((sum, ctx) => sum + ctx.weight, 0);
  return { contexts, totalWeight };
}

/**
 * Pure vector similarity search (no full-text requirement)
 * Finds semantically similar content without keyword matching
 */
export async function vectorSearch(params: {
  query: string;
  sources?: Array<"content_cache" | "paa" | "cluster" | "tweet">;
  threshold?: number;
  limit?: number;
}): Promise<RagResult> {
  const pool = getDbPool();
  if (!pool || !isEmbeddingEnabled()) {
    return { contexts: [], totalWeight: 0 };
  }

  const threshold = params.threshold ?? 0.6;
  const limit = params.limit ?? 10;
  const sources = params.sources ?? [
    "content_cache",
    "paa",
    "cluster",
    "tweet",
  ];

  const queryEmbedding = await generateEmbedding(
    prepareTextForEmbedding(params.query),
  );
  if (!queryEmbedding) {
    return { contexts: [], totalWeight: 0 };
  }

  const contexts: RagContext[] = [];

  // Tweets have a dedicated vector search function
  if (sources.includes("tweet")) {
    try {
      const result = await pool.query<{
        tweet_id: string;
        full_text: string;
        url: string;
        like_count: number;
        created_at: Date;
        similarity: number;
      }>(
        `
        SELECT * FROM elongoat.search_tweets_vector(
          $1::vector,
          $2::float,
          $3::int,
          0,
          true,
          true
        )
        `,
        [`[${queryEmbedding.embedding.join(",")}]`, threshold, limit],
      );

      for (const row of result.rows) {
        contexts.push({
          source: "tweet",
          weight: 0.9,
          snippet: row.full_text,
          tweetUrl: row.url || "",
          tweetLikes: row.like_count,
          tweetDate: row.created_at.toISOString().split("T")[0],
          vectorSimilarity: row.similarity,
        });
      }
    } catch (e) {
      console.error("[vectorSearch] Tweet error:", e);
    }
  }

  // Content cache vector search
  if (sources.includes("content_cache")) {
    try {
      const result = await pool.query<{
        slug: string;
        content_md: string;
        kind: string;
        similarity: number;
      }>(
        `
        SELECT
          slug,
          LEFT(content_md, 500) as content_md,
          kind,
          1 - (embedding <=> $1::vector) as similarity
        FROM elongoat.content_cache
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        `,
        [`[${queryEmbedding.embedding.join(",")}]`, threshold, limit],
      );

      for (const row of result.rows) {
        contexts.push({
          source: "content_cache",
          weight: 1.0,
          title: row.slug,
          snippet: row.content_md,
          vectorSimilarity: row.similarity,
        });
      }
    } catch (e) {
      console.error("[vectorSearch] Content cache error:", e);
    }
  }

  // Sort by similarity (descending)
  contexts.sort(
    (a, b) => (b.vectorSimilarity ?? 0) - (a.vectorSimilarity ?? 0),
  );

  const totalWeight = contexts.reduce((sum, ctx) => sum + ctx.weight, 0);
  return { contexts, totalWeight };
}
