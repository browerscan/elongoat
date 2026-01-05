import {
  calculateFreshness,
  getFreshnessLabel,
  getFreshnessColor,
} from "./contentFreshness";
import { getEnv } from "./env";

// Compression utilities for large payloads
import { compressForStorage, decompressFromStorage } from "./compression";

const env = getEnv();

// Lazy imports for backend-only dependencies
let getDbPool: typeof import("./db").getDbPool | undefined;
let tieredGet: typeof import("./tieredCache").get | undefined;
let tieredSet: typeof import("./tieredCache").set | undefined;
let buildKey: typeof import("./tieredCache").buildKey | undefined;

async function getBackendModules() {
  try {
    const dbModule = await import("./db");
    const cacheModule = await import("./tieredCache");
    getDbPool = dbModule.getDbPool;
    tieredGet = cacheModule.get;
    tieredSet = cacheModule.set;
    buildKey = cacheModule.buildKey;
  } catch {
    // Modules not available in static export
  }
}

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
  freshness?: {
    isStale: boolean;
    status: "fresh" | "aging" | "stale";
    label: string;
    color: string;
  };
};

export interface ContentCacheResult {
  content: CachedContent | null;
  source: "l1" | "l2" | "database" | "fallback";
  latency: number;
}

// ============================================================================
// Configuration
// ============================================================================

const L1_TTL_MS = env.CONTENT_CACHE_L1_TTL_MS; // 5 minutes
const L2_TTL_MS = env.CONTENT_CACHE_L2_TTL_MS; // 1 hour

// Compression threshold: compress payloads larger than 1KB
const COMPRESSION_THRESHOLD_BYTES = 1024;

// ============================================================================
// Cache Key Builders
// ============================================================================

function buildContentCacheKey(kind: string, slug: string): string {
  if (!buildKey) return `cc:content:${kind}:${slug}`;
  return buildKey(["content", kind, slug], "cc");
}

// ============================================================================
// Database Fetch Functions
// ============================================================================

async function fetchContentFromDatabase(
  kind: string,
  slug: string,
): Promise<CachedContent | null> {
  const db = getDbPool?.();
  if (!db) return null;

  try {
    const res = await db.query<{
      kind: string;
      slug: string;
      model: string | null;
      content_md: string;
      updated_at: string;
      expires_at: string | null;
      compressed: boolean | null;
      compression_method: string | null;
    }>(
      `
      select kind, slug, model, content_md, updated_at, expires_at,
             coalesce(compressed, false) as compressed,
             compression_method
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

    // Decompress content if needed
    let contentMd = row.content_md;
    if (row.compressed && row.content_md) {
      try {
        contentMd = await decompressFromStorage(
          row.content_md,
          (row.compression_method as "gzip" | "deflate") ?? "gzip",
        );
      } catch (decompressError) {
        console.warn(
          "[ContentCache] Decompression failed, using raw content:",
          {
            kind,
            slug,
            error:
              decompressError instanceof Error
                ? decompressError.message
                : String(decompressError),
          },
        );
      }
    }

    return {
      kind: row.kind,
      slug: row.slug,
      model: row.model,
      contentMd,
      updatedAt: new Date(row.updated_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    };
  } catch (error) {
    console.error("[ContentCache] Database fetch error:", {
      kind,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
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
 * Includes freshness information if content is found.
 */
export async function getCachedContent(params: {
  kind: string;
  slug: string;
  includeFreshness?: boolean;
}): Promise<CachedContent | null> {
  await getBackendModules();
  const cacheKey = buildContentCacheKey(params.kind, params.slug);

  try {
    if (!tieredGet) {
      // Static export fallback - no cache
      return null;
    }
    const result = await tieredGet(
      cacheKey,
      () => fetchContentFromDatabase(params.kind, params.slug),
      {
        l1Ttl: L1_TTL_MS,
        l2Ttl: L2_TTL_MS,
      },
    );

    if (env.NODE_ENV === "development" && !result.hit) {
      console.log(
        "[ContentCache] Cache miss for",
        params.kind,
        "/",
        params.slug,
        "- fetched from database",
      );
    }

    const content = result.data as CachedContent | null;

    // Add freshness information if requested
    if (content && params.includeFreshness !== false) {
      const freshness = calculateFreshness(
        content.updatedAt,
        content.expiresAt,
      );
      content.freshness = {
        isStale: freshness.isStale,
        status: freshness.status,
        label: getFreshnessLabel(freshness),
        color: getFreshnessColor(freshness),
      };
    }

    return content;
  } catch (error) {
    // Log error with context for debugging
    console.error("[ContentCache] Cache error, falling back to database:", {
      kind: params.kind,
      slug: params.slug,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to direct database query on cache errors
    const content = await fetchContentFromDatabase(params.kind, params.slug);
    if (content && params.includeFreshness !== false) {
      const freshness = calculateFreshness(
        content.updatedAt,
        content.expiresAt,
      );
      content.freshness = {
        isStale: freshness.isStale,
        status: freshness.status,
        label: getFreshnessLabel(freshness),
        color: getFreshnessColor(freshness),
      };
    }
    return content;
  }
}

/**
 * Gets cached content with detailed metadata about the cache source.
 */
export async function getCachedContentWithMetadata(params: {
  kind: string;
  slug: string;
}): Promise<ContentCacheResult> {
  await getBackendModules();
  const cacheKey = buildContentCacheKey(params.kind, params.slug);
  const startTime = performance.now();

  try {
    if (!tieredGet) {
      const content = await fetchContentFromDatabase(params.kind, params.slug);
      return {
        content,
        source: "fallback",
        latency: Math.round(performance.now() - startTime),
      };
    }
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
  } catch (error) {
    // Log error with context for debugging
    console.error(
      "[ContentCache] Cache error in getCachedContentWithMetadata:",
      {
        kind: params.kind,
        slug: params.slug,
        error: error instanceof Error ? error.message : String(error),
      },
    );

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
  await getBackendModules();
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

  // Store in tiered cache (always store uncompressed for fast access)
  if (tieredSet) {
    await tieredSet(cacheKey, payload, {
      l1Ttl: Math.min(L1_TTL_MS, params.ttlSeconds * 1000),
      l2Ttl: params.ttlSeconds * 1000,
    });
  }

  // Store in database for persistence
  const db = getDbPool?.();
  if (!db) return;

  try {
    // Compress content if larger than threshold
    const contentSize = Buffer.byteLength(params.contentMd, "utf-8");
    let contentToStore = params.contentMd;
    let compressed = false;
    let compressionMethod: "gzip" | "deflate" | null = null;

    if (contentSize > COMPRESSION_THRESHOLD_BYTES) {
      const compressionResult = await compressForStorage(params.contentMd, {
        minSize: COMPRESSION_THRESHOLD_BYTES,
        method: "gzip",
        level: 6,
      });
      if (compressionResult.compressed) {
        contentToStore = compressionResult.data;
        compressed = true;
        compressionMethod = compressionResult.method;
        if (env.NODE_ENV === "development") {
          console.log("[ContentCache] Compressed content:", {
            kind: params.kind,
            slug: params.slug,
            originalSize: contentSize,
            compressedSize: Buffer.byteLength(contentToStore, "utf-8"),
            ratio:
              (
                (Buffer.byteLength(contentToStore, "utf-8") / contentSize) *
                100
              ).toFixed(1) + "%",
          });
        }
      }
    }

    await db.query(
      `
      insert into elongoat.content_cache (cache_key, kind, slug, model, content_md, sources, generated_at, expires_at, compressed, compression_method)
      values ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9)
      on conflict (cache_key) do update set
        kind = excluded.kind,
        slug = excluded.slug,
        model = excluded.model,
        content_md = excluded.content_md,
        sources = excluded.sources,
        generated_at = excluded.generated_at,
        expires_at = excluded.expires_at,
        updated_at = now(),
        compressed = excluded.compressed,
        compression_method = excluded.compression_method
      `,
      [
        cacheKey,
        params.kind,
        params.slug,
        params.model,
        contentToStore,
        params.sources ? JSON.stringify(params.sources) : null,
        expiresAt ? expiresAt.toISOString() : null,
        compressed,
        compressionMethod,
      ],
    );
  } catch (error) {
    // Log error but don't throw - cache is best-effort
    console.error("[ContentCache] Database store error:", {
      kind: params.kind,
      slug: params.slug,
      error: error instanceof Error ? error.message : String(error),
    });
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
  const { del } = await import("./tieredCache");
  await del(cacheKey);
}

/**
 * Invalidates all cached content matching a pattern.
 */
export async function invalidateContentPattern(
  pattern: string,
): Promise<number> {
  const { invalidatePattern } = await import("./tieredCache");
  return await invalidatePattern("cc:" + pattern);
}

/**
 * Gets a set of slugs that have AI-generated content in the cache.
 * Used to prioritize displaying pages with actual AI content.
 */
export async function getSlugsWithAiContent(
  kind: "cluster_page" | "paa_question",
): Promise<Set<string>> {
  await getBackendModules();
  const db = getDbPool?.();
  if (!db) return new Set();

  try {
    const res = await db.query<{ slug: string }>(
      `
      SELECT DISTINCT slug
      FROM elongoat.content_cache
      WHERE kind = $1
        AND (expires_at IS NULL OR expires_at > NOW())
        AND content_md IS NOT NULL
        AND LENGTH(content_md) > 500
      `,
      [kind],
    );
    return new Set(res.rows.map((r) => r.slug));
  } catch (error) {
    console.error("[ContentCache] Error fetching AI content slugs:", {
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set();
  }
}
