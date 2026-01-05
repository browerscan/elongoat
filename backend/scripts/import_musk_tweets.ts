/**
 * Import Elon Musk tweets from CSV to PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=... npx tsx backend/scripts/import_musk_tweets.ts
 *   DATABASE_URL=... npx tsx backend/scripts/import_musk_tweets.ts --dry-run
 *   DATABASE_URL=... npx tsx backend/scripts/import_musk_tweets.ts --batch-size=500
 */

import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { Pool } from "pg";
import path from "path";

// Configuration
const CSV_PATH = path.resolve(__dirname, "../../data/all_musk_posts.csv");
const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith("--batch-size="))?.split("=")[1] ||
    "1000",
  10,
);
const DRY_RUN = process.argv.includes("--dry-run");

interface CsvRow {
  id: string;
  url: string;
  twitterUrl: string;
  fullText: string;
  retweetCount: string;
  replyCount: string;
  likeCount: string;
  quoteCount: string;
  viewCount: string;
  createdAt: string;
  bookmarkCount: string;
  isReply: string;
  inReplyToId: string;
  conversationId: string;
  inReplyToUserId: string;
  inReplyToUsername: string;
  isPinned: string;
  isRetweet: string;
  isQuote: string;
  isConversationControlled: string;
  possiblySensitive: string;
  quoteId: string;
  quote: string;
  retweet: string;
}

function parseBoolean(val: string): boolean {
  return val?.toLowerCase() === "true";
}

function parseIntSafe(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function parseBigIntSafe(val: string): bigint | null {
  try {
    const n = BigInt(val);
    return n;
  } catch {
    return null;
  }
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseJson(val: string): object | null {
  if (!val || val.trim() === "") return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== Musk Tweets Import ===");
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log("");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

  try {
    // Verify connection
    await pool.query("SELECT 1");
    console.log("✓ Database connected");

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'elongoat' AND table_name = 'musk_tweets'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.error(
        "✗ Table elongoat.musk_tweets does not exist. Run migration first:",
      );
      console.error(
        "  psql $DATABASE_URL -f backend/supabase/migrations/002_musk_tweets.sql",
      );
      process.exit(1);
    }
    console.log("✓ Table elongoat.musk_tweets exists");

    // Get existing count
    const existingCount = await pool.query(
      "SELECT COUNT(*) FROM elongoat.musk_tweets",
    );
    console.log(`ℹ Existing tweets: ${existingCount.rows[0].count}`);

    // Stream parse CSV
    const parser = createReadStream(CSV_PATH).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
      }),
    );

    let batch: CsvRow[] = [];
    let totalProcessed = 0;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    const processBatch = async (rows: CsvRow[]) => {
      if (DRY_RUN) {
        console.log(`[DRY RUN] Would insert ${rows.length} rows`);
        return rows.length;
      }

      // Use ON CONFLICT DO NOTHING for upsert behavior
      const values: unknown[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const offset = i * 21;

        const createdAt = parseDate(row.createdAt);
        if (!createdAt) {
          skipped++;
          continue;
        }

        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21})`,
        );

        values.push(
          row.id, // tweet_id
          row.fullText || "", // full_text
          row.url || null, // url
          row.twitterUrl || null, // twitter_url
          parseIntSafe(row.retweetCount), // retweet_count
          parseIntSafe(row.replyCount), // reply_count
          parseIntSafe(row.likeCount), // like_count
          parseIntSafe(row.quoteCount), // quote_count
          parseBigIntSafe(row.viewCount)?.toString() || "0", // view_count (as string for bigint)
          parseIntSafe(row.bookmarkCount), // bookmark_count
          createdAt.toISOString(), // created_at
          parseBoolean(row.isReply), // is_reply
          parseBoolean(row.isRetweet), // is_retweet
          parseBoolean(row.isQuote), // is_quote
          parseBoolean(row.isPinned), // is_pinned
          parseBoolean(row.possiblySensitive), // possibly_sensitive
          row.inReplyToId || null, // in_reply_to_id
          row.inReplyToUsername || null, // in_reply_to_username
          row.conversationId || null, // conversation_id
          parseJson(row.quote), // quote_data
          parseJson(row.retweet), // retweet_data
        );
      }

      if (placeholders.length === 0) return 0;

      const query = `
        INSERT INTO elongoat.musk_tweets (
          tweet_id, full_text, url, twitter_url,
          retweet_count, reply_count, like_count, quote_count, view_count, bookmark_count,
          created_at, is_reply, is_retweet, is_quote, is_pinned, possibly_sensitive,
          in_reply_to_id, in_reply_to_username, conversation_id,
          quote_data, retweet_data
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (tweet_id) DO NOTHING
      `;

      try {
        const result = await pool.query(query, values);
        return result.rowCount || 0;
      } catch (err) {
        console.error("Batch insert error:", err);
        errors += rows.length;
        return 0;
      }
    };

    console.log("\nImporting...");
    const startTime = Date.now();

    for await (const row of parser) {
      batch.push(row as CsvRow);
      totalProcessed++;

      if (batch.length >= BATCH_SIZE) {
        inserted += await processBatch(batch);
        batch = [];

        // Progress update every 10K
        if (totalProcessed % 10000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(
            `  Processed ${totalProcessed.toLocaleString()} rows (${elapsed}s)`,
          );
        }
      }
    }

    // Process remaining
    if (batch.length > 0) {
      inserted += await processBatch(batch);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n=== Import Complete ===");
    console.log(`Total rows: ${totalProcessed.toLocaleString()}`);
    console.log(`Inserted: ${inserted.toLocaleString()}`);
    console.log(`Skipped: ${skipped.toLocaleString()}`);
    console.log(`Errors: ${errors.toLocaleString()}`);
    console.log(`Time: ${totalTime}s`);

    // Final count
    const finalCount = await pool.query(
      "SELECT COUNT(*) FROM elongoat.musk_tweets",
    );
    console.log(`\nFinal count: ${finalCount.rows[0].count} tweets`);

    // Stats
    const stats = await pool.query("SELECT * FROM elongoat.musk_tweets_stats");
    if (stats.rows[0]) {
      const s = stats.rows[0];
      console.log("\n=== Stats ===");
      console.log(`Original tweets: ${s.original_tweets?.toLocaleString()}`);
      console.log(`Replies: ${s.replies?.toLocaleString()}`);
      console.log(`Retweets: ${s.retweets?.toLocaleString()}`);
      console.log(`Quote tweets: ${s.quote_tweets?.toLocaleString()}`);
      console.log(
        `Date range: ${s.earliest_tweet?.toISOString()?.split("T")[0]} to ${s.latest_tweet?.toISOString()?.split("T")[0]}`,
      );
      console.log(`Total likes: ${s.total_likes?.toLocaleString()}`);
      console.log(`Avg likes: ${s.avg_likes?.toLocaleString()}`);
      console.log(`Max likes: ${s.max_likes?.toLocaleString()}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
