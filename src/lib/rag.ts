// RAG is server-only by nature (DB access)
import { getDbPool } from "@/lib/db";

export type RagContext = {
  source: "paa" | "cluster" | "content_cache";
  weight: number;
  question?: string;
  answer?: string;
  title?: string;
  snippet?: string;
  volume?: number;
};

export type RagResult = {
  contexts: RagContext[];
  totalWeight: number;
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
        OR question ILIKE '%' || $1 || '%'
      ORDER BY rank DESC, volume DESC
      LIMIT $2
      `,
      [params.query, limit],
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
        OR page ILIKE '%' || $1 || '%'
        OR seed_keyword ILIKE '%' || $1 || '%'
      ORDER BY max_volume DESC
      LIMIT $2
      `,
      [params.query, limit],
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
 * Build comprehensive RAG context from multiple sources
 */
export async function buildRagContext(params: {
  query: string;
  includeContentCache?: boolean;
  includePaa?: boolean;
  includeClusters?: boolean;
}): Promise<RagResult> {
  const {
    includeContentCache = true,
    includePaa = true,
    includeClusters = true,
  } = params;

  const contexts: RagContext[] = [];

  // Fetch all sources in parallel
  const promises: Promise<RagContext[]>[] = [];

  if (includePaa) {
    promises.push(searchPaaContext({ query: params.query, limit: 8 }));
  }

  if (includeContentCache) {
    promises.push(searchContentCache({ query: params.query, limit: 3 }));
  }

  if (includeClusters) {
    promises.push(searchClusterContext({ query: params.query, limit: 5 }));
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
  const paaContexts = contexts.filter((c) => c.source === "paa");
  const cacheContexts = contexts.filter((c) => c.source === "content_cache");
  const clusterContexts = contexts.filter((c) => c.source === "cluster");

  if (paaContexts.length > 0) {
    sections.push("### Related Q&A (from Google PAA data):");
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
