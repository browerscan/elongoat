/**
 * Generate Embeddings for Musk Tweets
 *
 * Generates vector embeddings for all tweets in the musk_tweets table.
 * Supports resume/continuation and batch processing.
 *
 * Usage:
 *   npx tsx backend/scripts/generate_tweet_embeddings.ts
 *   npx tsx backend/scripts/generate_tweet_embeddings.ts --batch-size 50
 *   npx tsx backend/scripts/generate_tweet_embeddings.ts --skip-existing
 *   npx tsx backend/scripts/generate_tweet_embeddings.ts --min-likes 1000
 *   npx tsx backend/scripts/generate_tweet_embeddings.ts --original-only
 *
 * Progress tracking:
 *   Results are saved to data/generated/tweet_embeddings_progress.json
 */

import { getDb } from "../lib/db";
import {
  generateEmbeddingsBatch,
  prepareTextForEmbedding,
  formatEmbeddingForPg,
  isEmbeddingEnabled,
  type EmbeddingConfig,
} from "../../src/lib/embeddings";
import fs from "fs/promises";
import path from "path";

// ============================================================================
// Types
// ============================================================================

interface TweetRow {
  tweet_id: string;
  full_text: string;
  like_count: number;
  is_retweet: boolean;
  is_reply: boolean;
}

interface ProgressState {
  lastProcessedTweetId: string | null;
  processedCount: number;
  errorCount: number;
  lastUpdated: string;
  config: {
    batchSize: number;
    minLikes: number;
    originalOnly: boolean;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BATCH_SIZE = 50;
const PROGRESS_FILE = path.join(
  process.cwd(),
  "data/generated/tweet_embeddings_progress.json",
);

interface CliConfig {
  batchSize: number;
  skipExisting: boolean;
  minLikes: number;
  originalOnly: boolean;
  resumeAfter: string | null;
}

function parseArgs(): CliConfig {
  const args = process.argv.slice(2);
  const config: CliConfig = {
    batchSize: DEFAULT_BATCH_SIZE,
    skipExisting: true,
    minLikes: 0,
    originalOnly: false,
    resumeAfter: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--batch-size":
        config.batchSize = parseInt(args[++i], 10) || DEFAULT_BATCH_SIZE;
        break;
      case "--skip-existing":
        config.skipExisting = args[++i] !== "false";
        i++;
        break;
      case "--min-likes":
        config.minLikes = parseInt(args[++i], 10) || 0;
        break;
      case "--original-only":
        config.originalOnly = true;
        break;
      case "--after":
        config.resumeAfter = args[++i];
        break;
      case "--help":
        console.log(`
Usage: npx tsx backend/scripts/generate_tweet_embeddings.ts [options]

Options:
  --batch-size <n>       Number of tweets to process per batch (default: 50)
  --skip-existing <bool> Skip tweets that already have embeddings (default: true)
  --min-likes <n>        Only process tweets with at least N likes (default: 0)
  --original-only        Only process original tweets (no retweets)
  --after <tweet_id>     Resume processing after this tweet ID
  --help                 Show this help message

Examples:
  # Generate embeddings for all tweets without them
  npx tsx backend/scripts/generate_tweet_embeddings.ts

  # Process popular tweets first (1000+ likes)
  npx tsx backend/scripts/generate_tweet_embeddings.ts --min-likes 1000

  # Only process original tweets (no retweets/replies)
  npx tsx backend/scripts/generate_tweet_embeddings.ts --original-only

  # Resume from a specific tweet
  npx tsx backend/scripts/generate_tweet_embeddings.ts --after "1234567890"
        `);
        process.exit(0);
    }
  }

  return config;
}

// ============================================================================
// Progress Management
// ============================================================================

async function loadProgress(): Promise<ProgressState | null> {
  try {
    const content = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(content) as ProgressState;
  } catch {
    return null;
  }
}

async function saveProgress(state: ProgressState): Promise<void> {
  const dir = path.dirname(PROGRESS_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory may already exist
  }
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(state, null, 2));
}

// ============================================================================
// Tweet Embedding Generation
// ============================================================================

/**
 * Prepare tweet text for embedding
 * Removes URLs, mentions, and normalizes whitespace
 */
function prepareTweetForEmbedding(tweet: TweetRow): string {
  let text = tweet.full_text;

  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "");

  // Remove @mentions but keep the text
  text = text.replace(/@\w+/g, "");

  // Remove hashtags but keep the text
  text = text.replace(/#/g, "");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Limit to ~500 chars for embedding (focus on most relevant content)
  if (text.length > 500) {
    text = text.slice(0, 500);
  }

  return text;
}

/**
 * Build the WHERE clause for tweet selection
 */
function buildWhereClause(config: CliConfig, hasProgress: boolean): string {
  const conditions: string[] = [];

  if (config.skipExisting) {
    conditions.push("embedding IS NULL");
  }

  if (config.minLikes > 0) {
    conditions.push(`like_count >= ${config.minLikes}`);
  }

  if (config.originalOnly) {
    conditions.push("is_retweet = FALSE");
    conditions.push("is_reply = FALSE");
  }

  // Prioritize tweets with engagement for better RAG results
  if (!config.minLikes && !config.originalOnly) {
    // When no filters, still skip very low quality content
    conditions.push("LENGTH(full_text) > 30");
  }

  return conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
}

/**
 * Get the ORDER BY clause for processing
 */
function buildOrderByClause(config: CliConfig): string {
  if (config.minLikes > 0) {
    return "ORDER BY like_count DESC, created_at DESC";
  }
  return "ORDER BY created_at DESC";
}

/**
 * Generate embeddings for a batch of tweets
 */
async function processTweetBatch(
  tweets: TweetRow[],
  config: CliConfig,
): Promise<{ processed: number; errors: number; lastId: string | null }> {
  const db = getDb();
  let processed = 0;
  let errors = 0;
  let lastId: string | null = null;

  console.log(`Processing batch of ${tweets.length} tweets...`);

  // Prepare texts for embedding
  const texts = tweets.map((tweet) => prepareTweetForEmbedding(tweet));

  // Generate embeddings
  const embeddingResult = await generateEmbeddingsBatch(texts);

  if (!embeddingResult) {
    console.error("Failed to generate embeddings for batch");
    return { processed, errors: tweets.length, lastId };
  }

  // Update tweets with embeddings
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    const embedding = embeddingResult.embeddings[i];

    try {
      await db.query(
        `UPDATE elongoat.musk_tweets
         SET embedding = $1::vector
         WHERE tweet_id = $2`,
        [formatEmbeddingForPg(embedding), tweet.tweet_id],
      );
      processed++;
      lastId = tweet.tweet_id;
    } catch (error) {
      console.error(`Failed to update tweet ${tweet.tweet_id}:`, error);
      errors++;
    }
  }

  return { processed, errors, lastId };
}

/**
 * Main processing function
 */
async function generateTweetEmbeddings(
  config: CliConfig,
): Promise<{ processed: number; errors: number }> {
  const db = getDb();
  let totalProcessed = 0;
  let totalErrors = 0;
  let lastId: string | null = config.resumeAfter;

  // Build query
  const whereClause = buildWhereClause(config, false);
  const orderByClause = buildOrderByClause(config);

  // Get total count
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM elongoat.musk_tweets ${whereClause}`,
  );
  const total = parseInt(countResult.rows[0]?.count || "0", 10);
  console.log(`Found ${total} tweets to process`);

  if (total === 0) {
    console.log("No tweets to process. Already done?");
    return { processed: 0, errors: 0 };
  }

  // Process in batches
  let offset = 0;
  const batchSize = config.batchSize;

  while (offset < total) {
    // Fetch batch
    const result = await db.query<TweetRow>(
      `SELECT tweet_id, full_text, like_count, is_retweet, is_reply
       FROM elongoat.musk_tweets
       ${whereClause}
       ${orderByClause}
       LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    );

    if (result.rows.length === 0) break;

    // Process batch
    const {
      processed,
      errors,
      lastId: batchLastId,
    } = await processTweetBatch(result.rows, config);

    totalProcessed += processed;
    totalErrors += errors;
    lastId = batchLastId || lastId;

    // Update progress
    const currentTotal = Math.min(offset + batchSize, total);
    console.log(
      `[${currentTotal}/${total}] Processed ${totalProcessed}, errors ${totalErrors}`,
    );

    // Save progress every batch
    await saveProgress({
      lastProcessedTweetId: lastId,
      processedCount: totalProcessed,
      errorCount: totalErrors,
      lastUpdated: new Date().toISOString(),
      config: {
        batchSize: config.batchSize,
        minLikes: config.minLikes,
        originalOnly: config.originalOnly,
      },
    });

    offset += batchSize;

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return { processed: totalProcessed, errors: totalErrors };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("=== ElonGoat Tweet Embedding Generation ===\n");

  // Check if embeddings are enabled
  if (!isEmbeddingEnabled()) {
    console.error("ERROR: No embedding API key configured.");
    console.error("Set OPENAI_API_KEY or VECTORENGINE_API_KEY.");
    console.error("Or enable embeddings with EMBEDDINGS_ENABLED=1");
    process.exit(1);
  }

  const config = parseArgs();

  // Display configuration
  console.log("Configuration:");
  console.log(`  Batch size: ${config.batchSize}`);
  console.log(`  Skip existing: ${config.skipExisting}`);
  console.log(`  Min likes: ${config.minLikes || "none"}`);
  console.log(`  Original only: ${config.originalOnly}`);
  console.log(`  Resume after: ${config.resumeAfter || "none"}`);
  console.log("");

  // Check current embedding coverage
  const db = getDb();
  const statsResult = await db.query<{
    total_tweets: string;
    tweets_with_embedding: string;
    tweets_without_embedding: string;
  }>(`
    SELECT
      COUNT(*) as total_tweets,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as tweets_with_embedding,
      COUNT(*) FILTER (WHERE embedding IS NULL) as tweets_without_embedding
    FROM elongoat.musk_tweets
  `);

  const stats = statsResult.rows[0];
  const total = parseInt(stats.total_tweets || "0", 10);
  const withEmbedding = parseInt(stats.tweets_with_embedding || "0", 10);
  const withoutEmbedding = parseInt(stats.tweets_without_embedding || "0", 10);
  const coverage = total > 0 ? ((withEmbedding / total) * 100).toFixed(1) : "0";

  console.log("Current embedding coverage:");
  console.log(`  Total tweets: ${total.toLocaleString()}`);
  console.log(`  With embeddings: ${withEmbedding.toLocaleString()}`);
  console.log(`  Without embeddings: ${withoutEmbedding.toLocaleString()}`);
  console.log(`  Coverage: ${coverage}%`);
  console.log("");

  if (withoutEmbedding === 0) {
    console.log("All tweets already have embeddings!");
    process.exit(0);
  }

  // Generate embeddings
  const startTime = Date.now();
  const result = await generateTweetEmbeddings(config);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final stats
  console.log("\n=== Summary ===");
  console.log(`Processed: ${result.processed}`);
  console.log(`Errors: ${result.errors}`);
  console.log(`Duration: ${duration}s`);

  if (result.processed > 0) {
    console.log(
      `\nRate: ${parseInt(duration) > 0 ? (result.processed / parseInt(duration)).toFixed(1) : "N/A"} tweets/second`,
    );
  }

  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
