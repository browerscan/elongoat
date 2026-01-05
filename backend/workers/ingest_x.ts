import "dotenv/config";

import { getDb, withTransaction } from "../lib/db";
import { getEnv, requireEnv } from "../lib/env";
import {
  extractNextDataFromHtml,
  extractXHandlesFromText,
  parseTweetsFromSyndicationNextData,
} from "../lib/xSyndication";

const env = getEnv();

type TweetRow = {
  handle: string;
  tweet_id: string;
  url: string | null;
  content: string | null;
  posted_at: string | null;
  raw: unknown;
};

function parseHandles(): string[] {
  const raw = env.X_HANDLES.split(",")
    .map((s) => s.trim().replace(/^@/, ""))
    .filter(Boolean);
  return [...new Set(raw.map((h) => h.toLowerCase()))];
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

      // Don't retry on certain 4xx errors (client errors) except 429 (rate limit)
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
          `[x] ${label} failed (attempt ${attempt + 1}/${config.maxRetries}): ${lastError.message}. Retrying in ${delay}ms...`,
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

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          env.USER_AGENT ??
          "Mozilla/5.0 (compatible; ElonGoatBot/1.0; +https://elongoat.io)",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Fetch ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSyndicationNextData(handle: string): Promise<unknown> {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;

  return withRetry(
    async () => {
      const html = await fetchText(url, 20_000);
      const nextData = extractNextDataFromHtml(html);
      if (!nextData)
        throw new Error("Failed to locate __NEXT_DATA__ in syndication HTML");
      return nextData;
    },
    DEFAULT_RETRY_CONFIG,
    `syndication fetch for @${handle}`,
  );
}

async function soaxFetchMarkdown(url: string): Promise<string> {
  const secret = requireEnv("SOAX_API_SECRET");
  const baseUrl = (env.SOAX_BASE_URL ?? "https://scraping.soax.com").replace(
    /\/$/,
    "",
  );
  // Support both SOAX_COUNTRY (preferred) and SOAX_LOCATION (legacy)
  const country = env.SOAX_LOCATION ?? env.SOAX_COUNTRY ?? "us";

  return withRetry(
    async () => {
      const res = await fetch(`${baseUrl}/v1/webdata/fetch-content`, {
        method: "POST",
        headers: {
          "X-SOAX-API-Secret": secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          proxy_settings: {
            country,
            type: 1,
          },
          response: { markdown: true },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `SOAX fetch-content ${res.status}: ${text.slice(0, 200)}`,
        );
      }

      const json = (await res.json().catch(() => null)) as any;
      const content = json?.data?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("SOAX response missing data.content");
      }
      return content;
    },
    DEFAULT_RETRY_CONFIG,
    `SOAX fetch: ${url}`,
  );
}

async function upsertTweets(rows: TweetRow[]) {
  if (!rows.length) return;

  await withTransaction(async (client) => {
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let j = 0; j < batch.length; j++) {
        const base = j * 6;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`,
        );
        values.push(
          batch[j].handle,
          batch[j].tweet_id,
          batch[j].url,
          batch[j].content,
          batch[j].posted_at
            ? new Date(batch[j].posted_at).toISOString()
            : null,
          JSON.stringify(batch[j].raw),
        );
      }

      const sql = `
        insert into elongoat.x_tweets (handle, tweet_id, url, content, posted_at, raw)
        values ${tuples.join(",\n")}
        on conflict (tweet_id) do update set
          handle = excluded.handle,
          url = excluded.url,
          content = excluded.content,
          posted_at = excluded.posted_at,
          raw = excluded.raw,
          scraped_at = now();
      `;
      await client.query(sql, values);
    }
  });
}

async function upsertFollowingPairs(
  handle: string,
  followingHandles: string[],
) {
  const unique = [
    ...new Set(followingHandles.map((h) => h.toLowerCase())),
  ].filter(Boolean);
  if (!unique.length) return;

  await withTransaction(async (client) => {
    const batchSize = 500;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let j = 0; j < batch.length; j++) {
        const base = j * 2;
        tuples.push(`($${base + 1},$${base + 2})`);
        values.push(handle, batch[j]);
      }

      const sql = `
        insert into elongoat.x_following (handle, following_handle)
        values ${tuples.join(",\n")}
        on conflict (handle, following_handle) do update set
          scraped_at = now();
      `;
      await client.query(sql, values);
    }
  });
}

async function ingestHandle(handle: string) {
  const limit = env.X_MAX_TWEETS;
  const includeNonAuthor = env.X_INCLUDE_NON_AUTHOR;

  console.log(
    `[x] handle=@${handle} limit=${limit} include_non_author=${includeNonAuthor}`,
  );

  const nextData = await fetchSyndicationNextData(handle);
  const tweets = parseTweetsFromSyndicationNextData({
    monitoredHandle: handle,
    nextData,
    limit: Math.max(1, limit),
  });

  const rows: TweetRow[] = tweets
    .filter(
      (t) =>
        includeNonAuthor ||
        t.authorHandle.toLowerCase() === handle.toLowerCase(),
    )
    .map((t) => ({
      handle,
      tweet_id: t.tweetId,
      url: t.url,
      content: t.content || null,
      posted_at: t.postedAt,
      raw: t.raw,
    }));

  console.log(`[x] tweets parsed=${tweets.length} stored=${rows.length}`);
  await upsertTweets(rows);

  const fetchFollowing = env.X_FETCH_FOLLOWING;
  if (!fetchFollowing) return;

  if (!env.SOAX_API_SECRET) {
    console.log(
      "[x] X_FETCH_FOLLOWING=true but SOAX_API_SECRET is missing; skipping following.",
    );
    return;
  }

  try {
    const markdown = await soaxFetchMarkdown(
      `https://x.com/${handle}/following`,
    );
    const handles = extractXHandlesFromText(markdown).filter(
      (h) => h !== handle.toLowerCase(),
    );
    if (handles.length < 3) {
      console.log(
        `[x] following parse looked empty (handles=${handles.length}); skipping DB write.`,
      );
      return;
    }
    console.log(`[x] following handles extracted=${handles.length}`);
    await upsertFollowingPairs(handle, handles);
  } catch (err) {
    console.log(
      `[x] following fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function main() {
  requireEnv("DATABASE_URL");

  const handles = parseHandles();
  if (!handles.length) throw new Error("No X_HANDLES configured");

  for (const handle of handles) {
    await ingestHandle(handle);
  }

  await getDb().end();
  console.log("[x] Done");
}

main().catch((err) => {
  console.error("[x] Failed:", err);
  process.exitCode = 1;
});
