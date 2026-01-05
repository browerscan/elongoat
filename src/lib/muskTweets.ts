/**
 * Musk Tweets Library
 * Access 67K+ tweets from 2010-2025 for RAG, search, and display
 */
import "server-only";

import { getDbPool } from "./db";
import { escapeLikePattern } from "./sqlSecurity";

// ============================================================================
// Types
// ============================================================================

export interface MuskTweet {
  tweetId: string;
  fullText: string;
  url: string | null;
  twitterUrl: string | null;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
  createdAt: string;
  isReply: boolean;
  isRetweet: boolean;
  isQuote: boolean;
  inReplyToUsername: string | null;
}

export interface TweetSearchResult extends MuskTweet {
  rank: number;
  snippet: string;
}

export interface TweetStats {
  totalTweets: number;
  originalTweets: number;
  replies: number;
  retweets: number;
  quoteTweets: number;
  earliestTweet: string;
  latestTweet: string;
  totalLikes: number;
  avgLikes: number;
  maxLikes: number;
}

// ============================================================================
// Core Query Functions
// ============================================================================

/**
 * Search tweets using full-text search
 * Returns matching tweets ranked by relevance and engagement
 */
export async function searchTweets(params: {
  query: string;
  limit?: number;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  minLikes?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<TweetSearchResult[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const {
    query,
    limit = 20,
    includeReplies = true,
    includeRetweets = false,
    minLikes = 0,
    dateFrom,
    dateTo,
  } = params;

  try {
    const conditions: string[] = [
      "search_vector @@ plainto_tsquery('english', $1)",
    ];
    const values: unknown[] = [query];
    let paramIndex = 2;

    if (!includeRetweets) {
      conditions.push("is_retweet = FALSE");
    }

    if (!includeReplies) {
      conditions.push("is_reply = FALSE");
    }

    if (minLikes > 0) {
      conditions.push(`like_count >= $${paramIndex}`);
      values.push(minLikes);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(dateTo);
      paramIndex++;
    }

    values.push(Math.min(limit, 100));

    const result = await pool.query<{
      tweet_id: string;
      full_text: string;
      url: string | null;
      twitter_url: string | null;
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      view_count: string;
      bookmark_count: number;
      created_at: Date;
      is_reply: boolean;
      is_retweet: boolean;
      is_quote: boolean;
      in_reply_to_username: string | null;
      rank: number;
    }>(
      `
      SELECT
        tweet_id, full_text, url, twitter_url,
        retweet_count, reply_count, like_count, quote_count, view_count, bookmark_count,
        created_at, is_reply, is_retweet, is_quote, in_reply_to_username,
        ts_rank_cd(search_vector, plainto_tsquery('english', $1), 32) +
        (like_count::float / 1000000) as rank
      FROM elongoat.musk_tweets
      WHERE ${conditions.join(" AND ")}
      ORDER BY rank DESC, like_count DESC
      LIMIT $${paramIndex}
      `,
      values,
    );

    return result.rows.map((row) => ({
      tweetId: row.tweet_id,
      fullText: row.full_text,
      url: row.url,
      twitterUrl: row.twitter_url,
      retweetCount: row.retweet_count,
      replyCount: row.reply_count,
      likeCount: row.like_count,
      quoteCount: row.quote_count,
      viewCount: parseInt(row.view_count, 10) || 0,
      bookmarkCount: row.bookmark_count,
      createdAt: row.created_at.toISOString(),
      isReply: row.is_reply,
      isRetweet: row.is_retweet,
      isQuote: row.is_quote,
      inReplyToUsername: row.in_reply_to_username,
      rank: row.rank,
      snippet: row.full_text.slice(0, 280),
    }));
  } catch (error) {
    console.error("[muskTweets] Search error:", error);
    return [];
  }
}

/**
 * Get tweets for RAG context (high-quality, relevant tweets)
 * Optimized for chat context - returns concise, meaningful content
 */
export async function getTweetsForRag(params: {
  query: string;
  limit?: number;
}): Promise<
  Array<{
    text: string;
    url: string;
    likes: number;
    date: string;
    rank: number;
  }>
> {
  const pool = getDbPool();
  if (!pool) return [];

  const limit = Math.min(params.limit ?? 5, 10);

  try {
    // Search for original tweets (not retweets) with good engagement
    const result = await pool.query<{
      full_text: string;
      url: string | null;
      twitter_url: string | null;
      like_count: number;
      created_at: Date;
      rank: number;
    }>(
      `
      SELECT
        full_text, url, twitter_url, like_count, created_at,
        ts_rank_cd(search_vector, plainto_tsquery('english', $1), 32) as rank
      FROM elongoat.musk_tweets
      WHERE
        search_vector @@ plainto_tsquery('english', $1)
        AND is_retweet = FALSE
        AND length(full_text) > 50
      ORDER BY
        rank DESC,
        like_count DESC
      LIMIT $2
      `,
      [params.query, limit],
    );

    return result.rows.map((row) => ({
      text: row.full_text,
      url: row.url || row.twitter_url || "",
      likes: row.like_count,
      date: row.created_at.toISOString().split("T")[0],
      rank: row.rank,
    }));
  } catch (error) {
    console.error("[muskTweets] RAG query error:", error);
    return [];
  }
}

/**
 * Get popular tweets (for /x/popular page)
 */
export async function getPopularTweets(params: {
  limit?: number;
  offset?: number;
  year?: number;
}): Promise<MuskTweet[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const { limit = 50, offset = 0, year } = params;

  try {
    const conditions = ["is_retweet = FALSE", "is_reply = FALSE"];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM created_at) = $${paramIndex}`);
      values.push(year);
      paramIndex++;
    }

    values.push(Math.min(limit, 100), offset);

    const result = await pool.query<{
      tweet_id: string;
      full_text: string;
      url: string | null;
      twitter_url: string | null;
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      view_count: string;
      bookmark_count: number;
      created_at: Date;
      is_reply: boolean;
      is_retweet: boolean;
      is_quote: boolean;
      in_reply_to_username: string | null;
    }>(
      `
      SELECT
        tweet_id, full_text, url, twitter_url,
        retweet_count, reply_count, like_count, quote_count, view_count, bookmark_count,
        created_at, is_reply, is_retweet, is_quote, in_reply_to_username
      FROM elongoat.musk_tweets
      WHERE ${conditions.join(" AND ")}
      ORDER BY like_count DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values,
    );

    return result.rows.map(mapTweetRow);
  } catch (error) {
    console.error("[muskTweets] Popular query error:", error);
    return [];
  }
}

/**
 * Get timeline tweets (for /x page, reverse chronological)
 */
export async function getTimelineTweets(params: {
  limit?: number;
  offset?: number;
  includeReplies?: boolean;
  year?: number;
  month?: number;
}): Promise<MuskTweet[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const {
    limit = 50,
    offset = 0,
    includeReplies = false,
    year,
    month,
  } = params;

  try {
    const conditions = ["is_retweet = FALSE"];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (!includeReplies) {
      conditions.push("is_reply = FALSE");
    }

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM created_at) = $${paramIndex}`);
      values.push(year);
      paramIndex++;

      if (month) {
        conditions.push(`EXTRACT(MONTH FROM created_at) = $${paramIndex}`);
        values.push(month);
        paramIndex++;
      }
    }

    values.push(Math.min(limit, 100), offset);

    const result = await pool.query<{
      tweet_id: string;
      full_text: string;
      url: string | null;
      twitter_url: string | null;
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      view_count: string;
      bookmark_count: number;
      created_at: Date;
      is_reply: boolean;
      is_retweet: boolean;
      is_quote: boolean;
      in_reply_to_username: string | null;
    }>(
      `
      SELECT
        tweet_id, full_text, url, twitter_url,
        retweet_count, reply_count, like_count, quote_count, view_count, bookmark_count,
        created_at, is_reply, is_retweet, is_quote, in_reply_to_username
      FROM elongoat.musk_tweets
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values,
    );

    return result.rows.map(mapTweetRow);
  } catch (error) {
    console.error("[muskTweets] Timeline query error:", error);
    return [];
  }
}

/**
 * Get a single tweet by ID
 */
export async function getTweetById(tweetId: string): Promise<MuskTweet | null> {
  const pool = getDbPool();
  if (!pool) return null;

  try {
    const result = await pool.query<{
      tweet_id: string;
      full_text: string;
      url: string | null;
      twitter_url: string | null;
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      view_count: string;
      bookmark_count: number;
      created_at: Date;
      is_reply: boolean;
      is_retweet: boolean;
      is_quote: boolean;
      in_reply_to_username: string | null;
    }>(
      `
      SELECT
        tweet_id, full_text, url, twitter_url,
        retweet_count, reply_count, like_count, quote_count, view_count, bookmark_count,
        created_at, is_reply, is_retweet, is_quote, in_reply_to_username
      FROM elongoat.musk_tweets
      WHERE tweet_id = $1
      `,
      [tweetId],
    );

    if (result.rows.length === 0) return null;
    return mapTweetRow(result.rows[0]);
  } catch (error) {
    console.error("[muskTweets] GetById error:", error);
    return null;
  }
}

/**
 * Get tweet statistics
 */
export async function getTweetStats(): Promise<TweetStats | null> {
  const pool = getDbPool();
  if (!pool) return null;

  try {
    const result = await pool.query<{
      total_tweets: string;
      original_tweets: string;
      replies: string;
      retweets: string;
      quote_tweets: string;
      earliest_tweet: Date;
      latest_tweet: Date;
      total_likes: string;
      avg_likes: number;
      max_likes: number;
    }>("SELECT * FROM elongoat.musk_tweets_stats");

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    return {
      totalTweets: parseInt(row.total_tweets, 10) || 0,
      originalTweets: parseInt(row.original_tweets, 10) || 0,
      replies: parseInt(row.replies, 10) || 0,
      retweets: parseInt(row.retweets, 10) || 0,
      quoteTweets: parseInt(row.quote_tweets, 10) || 0,
      earliestTweet: row.earliest_tweet?.toISOString() || "",
      latestTweet: row.latest_tweet?.toISOString() || "",
      totalLikes: parseInt(row.total_likes, 10) || 0,
      avgLikes: row.avg_likes || 0,
      maxLikes: row.max_likes || 0,
    };
  } catch (error) {
    console.error("[muskTweets] Stats error:", error);
    return null;
  }
}

/**
 * Get tweets by year (for archive navigation)
 */
export async function getTweetCountsByYear(): Promise<
  Array<{ year: number; count: number }>
> {
  const pool = getDbPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{ year: number; count: string }>(`
      SELECT
        EXTRACT(YEAR FROM created_at)::int as year,
        COUNT(*)::text as count
      FROM elongoat.musk_tweets
      WHERE is_retweet = FALSE
      GROUP BY year
      ORDER BY year DESC
    `);

    return result.rows.map((row) => ({
      year: row.year,
      count: parseInt(row.count, 10) || 0,
    }));
  } catch (error) {
    console.error("[muskTweets] YearCounts error:", error);
    return [];
  }
}

/**
 * Find related tweets for an article/topic (for RelatedTweets component)
 */
export async function findRelatedTweets(params: {
  keywords: string[];
  limit?: number;
}): Promise<MuskTweet[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const { keywords, limit = 5 } = params;
  if (keywords.length === 0) return [];

  try {
    // Build search query from keywords
    const searchQuery = keywords.slice(0, 5).join(" | ");

    const result = await pool.query<{
      tweet_id: string;
      full_text: string;
      url: string | null;
      twitter_url: string | null;
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      view_count: string;
      bookmark_count: number;
      created_at: Date;
      is_reply: boolean;
      is_retweet: boolean;
      is_quote: boolean;
      in_reply_to_username: string | null;
    }>(
      `
      SELECT
        tweet_id, full_text, url, twitter_url,
        retweet_count, reply_count, like_count, quote_count, view_count, bookmark_count,
        created_at, is_reply, is_retweet, is_quote, in_reply_to_username
      FROM elongoat.musk_tweets
      WHERE
        search_vector @@ to_tsquery('english', $1)
        AND is_retweet = FALSE
        AND is_reply = FALSE
        AND length(full_text) > 80
      ORDER BY like_count DESC
      LIMIT $2
      `,
      [searchQuery, limit],
    );

    return result.rows.map(mapTweetRow);
  } catch (error) {
    console.error("[muskTweets] Related error:", error);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapTweetRow(row: {
  tweet_id: string;
  full_text: string;
  url: string | null;
  twitter_url: string | null;
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  view_count: string;
  bookmark_count: number;
  created_at: Date;
  is_reply: boolean;
  is_retweet: boolean;
  is_quote: boolean;
  in_reply_to_username: string | null;
}): MuskTweet {
  return {
    tweetId: row.tweet_id,
    fullText: row.full_text,
    url: row.url,
    twitterUrl: row.twitter_url,
    retweetCount: row.retweet_count,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    quoteCount: row.quote_count,
    viewCount: parseInt(row.view_count, 10) || 0,
    bookmarkCount: row.bookmark_count,
    createdAt: row.created_at.toISOString(),
    isReply: row.is_reply,
    isRetweet: row.is_retweet,
    isQuote: row.is_quote,
    inReplyToUsername: row.in_reply_to_username,
  };
}
