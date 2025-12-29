import "dotenv/config";

import { getDb, withTransaction } from "../lib/db";

type VideoResult = {
  title?: string;
  link?: string;
  displayed_link?: string;
  snippet?: string;
  duration?: string;
  position?: number;
  rich_snippet?: unknown;
  thumbnail?: string;
  date?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function extractChannel(displayedLink: string | undefined): string | null {
  if (!displayedLink) return null;
  const parts = displayedLink
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return null;
}

function safeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/**
 * Parse relative date strings like "2 days ago", "1 week ago", "3 months ago"
 * into ISO date strings. Returns null if parsing fails.
 */
function parseRelativeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const s = dateStr.toLowerCase().trim();

  const now = new Date();
  const match = s.match(
    /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/,
  );
  if (!match) {
    // Try to parse as absolute date
    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return null;
  }

  const num = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "second":
      now.setSeconds(now.getSeconds() - num);
      break;
    case "minute":
      now.setMinutes(now.getMinutes() - num);
      break;
    case "hour":
      now.setHours(now.getHours() - num);
      break;
    case "day":
      now.setDate(now.getDate() - num);
      break;
    case "week":
      now.setDate(now.getDate() - num * 7);
      break;
    case "month":
      now.setMonth(now.getMonth() - num);
      break;
    case "year":
      now.setFullYear(now.getFullYear() - num);
      break;
    default:
      return null;
  }

  return now.toISOString();
}

/**
 * Extract thumbnail URL from video result.
 * SOAX returns thumbnail in different locations depending on response format.
 */
function extractThumbnail(result: Record<string, unknown>): string | null {
  // Direct thumbnail field
  const thumbnail = safeString(result["thumbnail"]);
  if (thumbnail) return thumbnail;

  // Check rich_snippet for thumbnail
  const richSnippet = result["rich_snippet"];
  if (richSnippet && typeof richSnippet === "object") {
    const rs = richSnippet as Record<string, unknown>;
    const thumb = safeString(rs["thumbnail"]);
    if (thumb) return thumb;

    // Sometimes nested under "top"
    const top = rs["top"];
    if (top && typeof top === "object") {
      const topThumb = safeString(
        (top as Record<string, unknown>)["thumbnail"],
      );
      if (topThumb) return topThumb;
    }
  }

  // Generate YouTube thumbnail URL from video ID as fallback
  const link = safeString(result["link"]);
  if (link) {
    const videoId = parseYoutubeId(link);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  }

  return null;
}

function extractVideoResults(payload: unknown): VideoResult[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const list = obj["video_results"];
  if (!Array.isArray(list)) return [];
  return list
    .map((x) =>
      x && typeof x === "object" ? (x as Record<string, unknown>) : null,
    )
    .filter(Boolean)
    .map((x) => ({
      title: safeString(x!["title"]) ?? undefined,
      link: safeString(x!["link"]) ?? undefined,
      displayed_link: safeString(x!["displayed_link"]) ?? undefined,
      snippet: safeString(x!["snippet"]) ?? undefined,
      duration: safeString(x!["duration"]) ?? undefined,
      position: safeNumber(x!["position"]) ?? undefined,
      rich_snippet: x!["rich_snippet"],
      thumbnail: extractThumbnail(x!) ?? undefined,
      date: safeString(x!["date"]) ?? undefined,
    }));
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration for API calls.
 */
type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Execute a function with exponential backoff retry.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  label: string = "operation",
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on 4xx errors (client errors)
      if (lastError.message.includes(" 4")) {
        const match = lastError.message.match(/\b(4\d{2})\b/);
        if (match) {
          const statusCode = Number.parseInt(match[1], 10);
          if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
            throw lastError;
          }
        }
      }

      if (attempt < config.maxRetries - 1) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs,
        );
        console.log(
          `[videos] ${label} failed (attempt ${attempt + 1}/${config.maxRetries}): ${lastError.message}. Retrying in ${delay}ms...`,
        );
        await sleep(delay);
      }
    }
  }

  throw (
    lastError ??
    new Error(`${label} failed after ${config.maxRetries} attempts`)
  );
}

async function soaxGoogleVideos(query: string): Promise<unknown> {
  const secret = requireEnv("SOAX_API_SECRET");
  const baseUrl = (
    process.env.SOAX_BASE_URL ?? "https://scraping.soax.com"
  ).replace(/\/$/, "");
  // Support both SOAX_LOCATION (legacy) and SOAX_COUNTRY (unified)
  const location =
    process.env.SOAX_LOCATION ?? process.env.SOAX_COUNTRY ?? "United States";

  const url = new URL(`${baseUrl}/v1/serp/google_videos`);
  url.searchParams.set("q", query);
  url.searchParams.set("location", location);

  return withRetry(
    async () => {
      const res = await fetch(url, {
        headers: { "X-SOAX-API-Secret": secret },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `SOAX google_videos ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      return res.json();
    },
    DEFAULT_RETRY_CONFIG,
    `SERP query: ${query}`,
  );
}

async function main() {
  const queries = (
    process.env.VIDEO_QUERIES ??
    "elon musk interview,elon musk spacex,elon musk tesla"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!queries.length) throw new Error("No VIDEO_QUERIES provided");

  const limitPerQuery = Number.parseInt(
    process.env.VIDEO_LIMIT_PER_QUERY ?? "10",
    10,
  );

  const all: Array<{
    video_id: string;
    title: string | null;
    link: string;
    channel: string | null;
    snippet: string | null;
    duration: string | null;
    thumbnail: string | null;
    published_at: string | null;
    source_query: string;
    position: number | null;
  }> = [];

  for (const q of queries) {
    console.log(`[videos] SERP query: ${q}`);
    const payload = await soaxGoogleVideos(q);
    const results = extractVideoResults(payload).slice(
      0,
      Math.max(1, limitPerQuery),
    );
    console.log(`[videos] results=${results.length}`);

    for (const r of results) {
      const link = r.link;
      if (!link) continue;
      const id = parseYoutubeId(link);
      if (!id) continue;
      all.push({
        video_id: id,
        title: r.title ?? null,
        link,
        channel: extractChannel(r.displayed_link),
        snippet: r.snippet ?? null,
        duration: r.duration ?? null,
        thumbnail: r.thumbnail ?? null,
        published_at: parseRelativeDate(r.date),
        source_query: q,
        position: typeof r.position === "number" ? r.position : null,
      });
    }
  }

  // De-dup by video_id, keep best position.
  const byId = new Map<string, (typeof all)[number]>();
  for (const v of all) {
    const existing = byId.get(v.video_id);
    if (!existing) {
      byId.set(v.video_id, v);
      continue;
    }
    const a = existing.position ?? 999;
    const b = v.position ?? 999;
    if (b < a) byId.set(v.video_id, v);
  }

  const rows = [...byId.values()];
  console.log(`[videos] upserting videos=${rows.length}`);

  await withTransaction(async (client) => {
    // Insert in batches
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let j = 0; j < batch.length; j++) {
        const base = j * 8;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`,
        );
        values.push(
          batch[j].video_id,
          batch[j].title,
          batch[j].link,
          batch[j].channel,
          batch[j].snippet,
          batch[j].duration,
          batch[j].thumbnail,
          batch[j].published_at,
        );
      }

      const sql = `
        insert into elongoat.youtube_videos (video_id, title, link, channel, snippet, duration, thumbnail, published_at)
        values ${tuples.join(",\n")}
        on conflict (video_id) do update set
          title = excluded.title,
          link = excluded.link,
          channel = excluded.channel,
          snippet = excluded.snippet,
          duration = excluded.duration,
          thumbnail = coalesce(excluded.thumbnail, elongoat.youtube_videos.thumbnail),
          published_at = coalesce(excluded.published_at, elongoat.youtube_videos.published_at),
          scraped_at = now();
      `;
      await client.query(sql, values);
    }

    // Update source_query separately (keep the latest ingest query)
    const srcBatchSize = 400;
    for (let i = 0; i < rows.length; i += srcBatchSize) {
      const batch = rows.slice(i, i + srcBatchSize);
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let j = 0; j < batch.length; j++) {
        const base = j * 2;
        tuples.push(`($${base + 1},$${base + 2})`);
        values.push(batch[j].video_id, batch[j].source_query);
      }
      const sql = `
        with v(video_id, source_query) as (values ${tuples.join(",\n")})
        update elongoat.youtube_videos y
        set source_query = v.source_query, scraped_at = now()
        from v
        where y.video_id = v.video_id;
      `;
      await client.query(sql, values);
    }
  });

  console.log("[videos] Done");
  await getDb().end();
}

main().catch((err) => {
  console.error("[videos] Failed:", err);
  process.exitCode = 1;
});
