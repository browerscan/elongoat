/**
 * Generate Embeddings Script
 *
 * Generates embeddings for all content in the database and stores them
 * for vector similarity search.
 *
 * Usage:
 *   npx tsx backend/scripts/generate_embeddings.ts
 *   npx tsx backend/scripts/generate_embeddings.ts --table content_cache
 *   npx tsx backend/scripts/generate_embeddings.ts --batch-size 50
 *   npx tsx backend/scripts/generate_embeddings.ts --skip-existing
 */

import { getDb } from "../lib/db";
import {
  generateEmbeddingsBatch,
  prepareContentCacheForEmbedding,
  preparePaaForEmbedding,
  prepareClusterForEmbedding,
  formatEmbeddingForPg,
  isEmbeddingEnabled,
} from "../../src/lib/embeddings";

// ============================================================================
// Types
// ============================================================================

interface ContentCacheRow {
  id: string;
  slug: string;
  content_md: string;
}

interface PaaRow {
  id: string;
  question: string;
  answer: string | null;
}

interface ClusterRow {
  id: string;
  topic: string;
  page: string;
  seed_keyword: string | null;
}

type TableName = "content_cache" | "paa_tree" | "cluster_pages";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BATCH_SIZE = 20;

// Parse CLI arguments
function parseArgs(): {
  table?: TableName;
  batchSize: number;
  skipExisting: boolean;
} {
  const args = process.argv.slice(2);
  let table: TableName | undefined;
  let batchSize = DEFAULT_BATCH_SIZE;
  let skipExisting = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--table" && args[i + 1]) {
      const t = args[i + 1] as TableName;
      if (["content_cache", "paa_tree", "cluster_pages"].includes(t)) {
        table = t;
      }
      i++;
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10) || DEFAULT_BATCH_SIZE;
      i++;
    } else if (args[i] === "--skip-existing") {
      skipExisting = true;
    }
  }

  return { table, batchSize, skipExisting };
}

// ============================================================================
// Embedding Generation Functions
// ============================================================================

async function generateContentCacheEmbeddings(
  batchSize: number,
  skipExisting: boolean,
): Promise<{ processed: number; errors: number }> {
  const db = getDb();
  let processed = 0;
  let errors = 0;

  // Get rows without embeddings (or all if not skipping)
  const whereClause = skipExisting ? "WHERE embedding IS NULL" : "";
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM elongoat.content_cache ${whereClause}`,
  );
  const total = parseInt(countResult.rows[0]?.count || "0", 10);

  console.log(`[ContentCache] Found ${total} rows to process`);

  let offset = 0;
  while (offset < total) {
    const result = await db.query<ContentCacheRow>(
      `SELECT id, slug, content_md
       FROM elongoat.content_cache
       ${whereClause}
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    );

    if (result.rows.length === 0) break;

    // Prepare texts for embedding
    const texts = result.rows.map((row) =>
      prepareContentCacheForEmbedding(row.slug, row.content_md),
    );

    // Generate embeddings
    const embeddingResult = await generateEmbeddingsBatch(texts);

    if (!embeddingResult) {
      console.error(
        `[ContentCache] Failed to generate embeddings for batch at offset ${offset}`,
      );
      errors += result.rows.length;
      offset += batchSize;
      continue;
    }

    // Update rows with embeddings
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const embedding = embeddingResult.embeddings[i];

      try {
        await db.query(
          `UPDATE elongoat.content_cache
           SET embedding = $1::vector
           WHERE id = $2`,
          [formatEmbeddingForPg(embedding), row.id],
        );
        processed++;
      } catch (error) {
        console.error(`[ContentCache] Failed to update ${row.id}:`, error);
        errors++;
      }
    }

    console.log(
      `[ContentCache] Processed ${Math.min(offset + batchSize, total)}/${total} (${processed} success, ${errors} errors)`,
    );

    offset += batchSize;

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { processed, errors };
}

async function generatePaaEmbeddings(
  batchSize: number,
  skipExisting: boolean,
): Promise<{ processed: number; errors: number }> {
  const db = getDb();
  let processed = 0;
  let errors = 0;

  const whereClause = skipExisting ? "WHERE embedding IS NULL" : "";
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM elongoat.paa_tree ${whereClause}`,
  );
  const total = parseInt(countResult.rows[0]?.count || "0", 10);

  console.log(`[PAA] Found ${total} rows to process`);

  let offset = 0;
  while (offset < total) {
    const result = await db.query<PaaRow>(
      `SELECT id, question, answer
       FROM elongoat.paa_tree
       ${whereClause}
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    );

    if (result.rows.length === 0) break;

    const texts = result.rows.map((row) =>
      preparePaaForEmbedding(row.question, row.answer),
    );

    const embeddingResult = await generateEmbeddingsBatch(texts);

    if (!embeddingResult) {
      console.error(
        `[PAA] Failed to generate embeddings for batch at offset ${offset}`,
      );
      errors += result.rows.length;
      offset += batchSize;
      continue;
    }

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const embedding = embeddingResult.embeddings[i];

      try {
        await db.query(
          `UPDATE elongoat.paa_tree
           SET embedding = $1::vector
           WHERE id = $2`,
          [formatEmbeddingForPg(embedding), row.id],
        );
        processed++;
      } catch (error) {
        console.error(`[PAA] Failed to update ${row.id}:`, error);
        errors++;
      }
    }

    console.log(
      `[PAA] Processed ${Math.min(offset + batchSize, total)}/${total} (${processed} success, ${errors} errors)`,
    );

    offset += batchSize;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { processed, errors };
}

async function generateClusterEmbeddings(
  batchSize: number,
  skipExisting: boolean,
): Promise<{ processed: number; errors: number }> {
  const db = getDb();
  let processed = 0;
  let errors = 0;

  const whereClause = skipExisting ? "WHERE embedding IS NULL" : "";
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM elongoat.cluster_pages ${whereClause}`,
  );
  const total = parseInt(countResult.rows[0]?.count || "0", 10);

  console.log(`[Clusters] Found ${total} rows to process`);

  let offset = 0;
  while (offset < total) {
    const result = await db.query<ClusterRow>(
      `SELECT id, topic, page, seed_keyword
       FROM elongoat.cluster_pages
       ${whereClause}
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [batchSize, offset],
    );

    if (result.rows.length === 0) break;

    const texts = result.rows.map((row) =>
      prepareClusterForEmbedding(row.topic, row.page, row.seed_keyword),
    );

    const embeddingResult = await generateEmbeddingsBatch(texts);

    if (!embeddingResult) {
      console.error(
        `[Clusters] Failed to generate embeddings for batch at offset ${offset}`,
      );
      errors += result.rows.length;
      offset += batchSize;
      continue;
    }

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const embedding = embeddingResult.embeddings[i];

      try {
        await db.query(
          `UPDATE elongoat.cluster_pages
           SET embedding = $1::vector
           WHERE id = $2`,
          [formatEmbeddingForPg(embedding), row.id],
        );
        processed++;
      } catch (error) {
        console.error(`[Clusters] Failed to update ${row.id}:`, error);
        errors++;
      }
    }

    console.log(
      `[Clusters] Processed ${Math.min(offset + batchSize, total)}/${total} (${processed} success, ${errors} errors)`,
    );

    offset += batchSize;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { processed, errors };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("=== ElonGoat Embedding Generation ===\n");

  // Check if embeddings are enabled
  if (!isEmbeddingEnabled()) {
    console.error(
      "ERROR: No embedding API key configured. Set OPENAI_API_KEY or VECTORENGINE_API_KEY.",
    );
    process.exit(1);
  }

  const { table, batchSize, skipExisting } = parseArgs();

  console.log(`Configuration:`);
  console.log(`  Table: ${table || "all"}`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Skip existing: ${skipExisting}`);
  console.log("");

  const results: Record<string, { processed: number; errors: number }> = {};

  if (!table || table === "content_cache") {
    console.log("\n--- Processing content_cache ---");
    results.content_cache = await generateContentCacheEmbeddings(
      batchSize,
      skipExisting,
    );
  }

  if (!table || table === "paa_tree") {
    console.log("\n--- Processing paa_tree ---");
    results.paa_tree = await generatePaaEmbeddings(batchSize, skipExisting);
  }

  if (!table || table === "cluster_pages") {
    console.log("\n--- Processing cluster_pages ---");
    results.cluster_pages = await generateClusterEmbeddings(
      batchSize,
      skipExisting,
    );
  }

  // Summary
  console.log("\n=== Summary ===");
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const [tableName, result] of Object.entries(results)) {
    console.log(
      `${tableName}: ${result.processed} processed, ${result.errors} errors`,
    );
    totalProcessed += result.processed;
    totalErrors += result.errors;
  }

  console.log(`\nTotal: ${totalProcessed} processed, ${totalErrors} errors`);

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
