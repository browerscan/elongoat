import "server-only";

import { getDbPool } from "@/lib/db";

export type XTweetRow = {
  handle: string;
  tweetId: string;
  url: string | null;
  content: string | null;
  postedAt: string | null;
  scrapedAt: string;
  raw: unknown;
};

export type XFollowingRow = {
  handle: string;
  followingHandle: string;
  scrapedAt: string;
};

export async function listXTweets(params: {
  handle: string;
  limit?: number;
}): Promise<XTweetRow[]> {
  const db = getDbPool();
  if (!db) return [];

  const limit = Math.max(1, Math.min(200, params.limit ?? 60));
  const handle = params.handle.trim().replace(/^@/, "").toLowerCase();

  try {
    const res = await db.query<{
      handle: string;
      tweet_id: string;
      url: string | null;
      content: string | null;
      posted_at: string | null;
      scraped_at: string;
      raw: unknown;
    }>(
      `
      select handle, tweet_id, url, content, posted_at, scraped_at, raw
      from elongoat.x_tweets
      where handle = $1
      order by coalesce(posted_at, scraped_at) desc, scraped_at desc
      limit $2
      `,
      [handle, limit],
    );

    return res.rows.map((r) => ({
      handle: r.handle,
      tweetId: r.tweet_id,
      url: r.url,
      content: r.content,
      postedAt: r.posted_at ? new Date(r.posted_at).toISOString() : null,
      scrapedAt: new Date(r.scraped_at).toISOString(),
      raw: r.raw,
    }));
  } catch {
    return [];
  }
}

export async function listXFollowing(params: {
  handle: string;
  limit?: number;
}): Promise<XFollowingRow[]> {
  const db = getDbPool();
  if (!db) return [];

  const limit = Math.max(1, Math.min(5000, params.limit ?? 2000));
  const handle = params.handle.trim().replace(/^@/, "").toLowerCase();

  try {
    const res = await db.query<{
      handle: string;
      following_handle: string;
      scraped_at: string;
    }>(
      `
      select handle, following_handle, scraped_at
      from elongoat.x_following
      where handle = $1
      order by scraped_at desc, following_handle asc
      limit $2
      `,
      [handle, limit],
    );

    return res.rows.map((r) => ({
      handle: r.handle,
      followingHandle: r.following_handle,
      scrapedAt: new Date(r.scraped_at).toISOString(),
    }));
  } catch {
    return [];
  }
}
