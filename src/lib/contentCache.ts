import "server-only";

import { getDbPool } from "@/lib/db";
import {
  get as tieredGet,
  set as tieredSet,
  buildKey,
} from "@/lib/tieredCache";

// ============================================================================
// Types
// ============================================================================

export type CachedContent = {
  kind: string;
  slug: string;
  model: string | null;
  contentMd: string;
  updatedAt: string;
  expiresAt: string | null;
};

export interface ContentCacheResult {
  content: CachedContent | null;
  source: "l1" | "l2" | "database" | "fallback";
  latency: number;
}

// ============================================================================
// Configuration
// ============================================================================

const L1_TTL_MS = Number.parseInt(
  process.env.CONTENT_CACHE_L1_TTL_MS ?? "300000",
  10,
); // 5 minutes
const L2_TTL_MS = Number.parseInt(
  process.env.CONTENT_CACHE_L2_TTL_MS ?? "3600000",
  10,
); // 1 hour

// ============================================================================
// Cache Key Builders
// ============================================================================

function buildContentCacheKey(kind: string, slug: string): string {
  return buildKey(["content", kind, slug], "cc");
}

// ============================================================================
// Database Fetch Functions
// ============================================================================

async function fetchContentFromDatabase(
  kind: string,
  slug: string,
): Promise<CachedContent | null> {
  const db = getDbPool();
  if (!db) return null;

  try {
    const res = await db.query<{
      kind: string;
      slug: string;
      model: string | null;
      content_md: string;
      updated_at: string;
      expires_at: string | null;
    }>(
      `
      select kind, slug, model, content_md, updated_at, expires_at
      from elongoat.content_cache
      where kind = $1 and slug = $2
        and (expires_at is null or expires_at > now())
      order by generated_at desc
      limit 1
      `,
      [kind, slug],
    );
    const row = res.rows[0];
    if (!row) return null;

    return {
      kind: row.kind,
      slug: row.slug,
      model: row.model,
      contentMd: row.content_md,
      updatedAt: new Date(row.updated_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Gets cached content using the tiered cache system.
 *
 * - L1: In-memory cache (5 minutes)
 * - L2: Redis cache (1 hour)
 * - Database: Persistent storage
 *
 * Returns the content along with metadata about where it was found.
 */
export async function getCachedContent(params: {
  kind: string;
  slug: string;
}): Promise<CachedContent | null> {
  const cacheKey = buildContentCacheKey(params.kind, params.slug);

  try {
    const result = await tieredGet(
      cacheKey,
      () => fetchContentFromDatabase(params.kind, params.slug),
      {
        l1Ttl: L1_TTL_MS,
        l2Ttl: L2_TTL_MS,
      },
    );

    if (process.env.NODE_ENV === "development" && !result.hit) {
      console.log(
        "[ContentCache] Cache miss for",
        params.kind,
        "/",
        params.slug,
        "- fetched from database",
      );
    }

    return result.data as CachedContent | null;
  } catch {
    // Fallback to direct database query on cache errors
    return fetchContentFromDatabase(params.kind, params.slug);
  }
}

/**
 * Gets cached content with detailed metadata about the cache source.
 */
export async function getCachedContentWithMetadata(params: {
  kind: string;
  slug: string;
}): Promise<ContentCacheResult> {
  const cacheKey = buildContentCacheKey(params.kind, params.slug);
  const startTime = performance.now();

  try {
    const result = await tieredGet(
      cacheKey,
      () => fetchContentFromDatabase(params.kind, params.slug),
      {
        l1Ttl: L1_TTL_MS,
        l2Ttl: L2_TTL_MS,
      },
    );

    const sourceMap = {
      l1: "l1" as const,
      l2: "l2" as const,
      miss: "database" as const,
    };

    return {
      content: result.data as CachedContent | null,
      source: result.hit ? sourceMap[result.level] : "database",
      latency: result.latency,
    };
  } catch {
    const content = await fetchContentFromDatabase(params.kind, params.slug);
    return {
      content,
      source: "fallback",
      latency: Math.round(performance.now() - startTime),
    };
  }
}

/**
 * Sets cached content in all cache levels.
 */
export async function setCachedContent(params: {
  kind: string;
  slug: string;
  model: string;
  contentMd: string;
  ttlSeconds: number;
  sources?: unknown;
}): Promise<void> {
  const cacheKey = buildContentCacheKey(params.kind, params.slug);
  const expiresAt =
    params.ttlSeconds > 0
      ? new Date(Date.now() + params.ttlSeconds * 1000)
      : null;

  const payload: CachedContent = {
    kind: params.kind,
    slug: params.slug,
    model: params.model,
    contentMd: params.contentMd,
    updatedAt: new Date().toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };

  // Store in tiered cache
  await tieredSet(cacheKey, payload, {
    l1Ttl: Math.min(L1_TTL_MS, params.ttlSeconds * 1000),
    l2Ttl: params.ttlSeconds * 1000,
  });

  // Store in database for persistence
  const db = getDbPool();
  if (!db) return;

  try {
    await db.query(
      `
      insert into elongoat.content_cache (cache_key, kind, slug, model, content_md, sources, generated_at, expires_at)
      values ($1,$2,$3,$4,$5,$6,now(),$7)
      on conflict (cache_key) do update set
        kind = excluded.kind,
        slug = excluded.slug,
        model = excluded.model,
        content_md = excluded.content_md,
        sources = excluded.sources,
        generated_at = excluded.generated_at,
        expires_at = excluded.expires_at,
        updated_at = now()
      `,
      [
        cacheKey,
        params.kind,
        params.slug,
        params.model,
        params.contentMd,
        params.sources ? JSON.stringify(params.sources) : null,
        expiresAt ? expiresAt.toISOString() : null,
      ],
    );
  } catch {
    // Log error but don't throw - cache is best-effort
    if (process.env.NODE_ENV === "development") {
      console.error("[ContentCache] Failed to store content in database");
    }
  }
}

/**
 * Invalidates cached content for a specific kind/slug.
 */
export async function invalidateCachedContent(
  kind: string,
  slug: string,
): Promise<void> {
  const cacheKey = buildContentCacheKey(kind, slug);
  const { del } = await import("@/lib/tieredCache");
  await del(cacheKey);
}

/**
 * Invalidates all cached content matching a pattern.
 */
export async function invalidateContentPattern(
  pattern: string,
): Promise<number> {
  const { invalidatePattern } = await import("@/lib/tieredCache");
  return await invalidatePattern("cc:" + pattern);
}
