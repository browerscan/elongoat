/**
 * Import AI-generated markdown articles to content_cache table
 *
 * Usage:
 *   DATABASE_URL=... npx tsx backend/scripts/import_content_cache.ts
 *   DATABASE_URL=... npx tsx backend/scripts/import_content_cache.ts --dry-run
 */

import { readdirSync, readFileSync } from "fs";
import { Pool } from "pg";
import path from "path";

const CONTENT_DIR = path.resolve(__dirname, "../../data/generated/content");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=== Content Cache Import ===");
  console.log(`Directory: ${CONTENT_DIR}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log("");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

  try {
    await pool.query("SELECT 1");
    console.log("✓ Database connected");

    // Get existing count
    const existingCount = await pool.query(
      "SELECT COUNT(*) FROM elongoat.content_cache",
    );
    console.log(`ℹ Existing content: ${existingCount.rows[0].count}`);

    // Read all markdown files
    const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
    console.log(`ℹ Found ${files.length} markdown files`);
    console.log("");

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const startTime = Date.now();

    for (const file of files) {
      const filePath = path.join(CONTENT_DIR, file);
      const content = readFileSync(filePath, "utf-8");

      // Parse filename: {topic_slug}_{page_slug}.md
      const basename = file.replace(".md", "");
      const parts = basename.split("_");

      if (parts.length < 2) {
        console.warn(`⚠ Invalid filename format: ${file}`);
        skipped++;
        continue;
      }

      const topicSlug = parts[0];
      const pageSlug = parts.slice(1).join("_");
      const slug = `${topicSlug}/${pageSlug}`;
      const cacheKey = `cluster:${slug}`;

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would import: ${slug}`);
        imported++;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO elongoat.content_cache
           (cache_key, kind, slug, content_md, model, generated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (cache_key) DO UPDATE SET
             content_md = EXCLUDED.content_md,
             updated_at = NOW()`,
          [cacheKey, "cluster", slug, content, "codex"],
        );
        imported++;

        if (imported % 100 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  Imported ${imported} articles (${elapsed}s)`);
        }
      } catch (err) {
        console.error(`✗ Error importing ${file}:`, err);
        errors++;
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n=== Import Complete ===");
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Time: ${totalTime}s`);

    // Final count
    if (!DRY_RUN) {
      const finalCount = await pool.query(
        "SELECT COUNT(*) FROM elongoat.content_cache",
      );
      console.log(`\nFinal count: ${finalCount.rows[0].count} articles`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
