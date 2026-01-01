import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb } from "../lib/db";
import { generateWithCodex, countWords } from "../lib/codex";
import { buildRagContext, formatRagContexts } from "../../src/lib/rag";

async function testRagSystem() {
  console.log("\n=== Testing RAG System ===\n");

  const testQueries = [
    "tesla model x",
    "elon musk net worth",
    "spacex starship",
  ];

  for (const query of testQueries) {
    console.log(`Query: "${query}"`);

    const ragResult = await buildRagContext({
      query,
      includePaa: true,
      includeContentCache: true,
      includeClusters: true,
    });

    console.log(`  Contexts found: ${ragResult.contexts.length}`);
    console.log(`  Total weight: ${ragResult.totalWeight.toFixed(2)}`);

    const bySource = {
      paa: ragResult.contexts.filter((c) => c.source === "paa").length,
      cache: ragResult.contexts.filter((c) => c.source === "content_cache")
        .length,
      cluster: ragResult.contexts.filter((c) => c.source === "cluster").length,
    };

    console.log(
      `  Sources: PAA=${bySource.paa}, Cache=${bySource.cache}, Cluster=${bySource.cluster}`,
    );
    console.log();
  }
}

async function testCodexGeneration() {
  console.log("\n=== Testing Codex Generation ===\n");

  const testPrompt = `
Write a 300-word article about Tesla's autopilot technology.

Include:
- Brief history
- Current capabilities
- Safety considerations
- Future outlook

Write ONLY the markdown content:
  `.trim();

  console.log("Generating content with Codex...");

  const result = await generateWithCodex({
    prompt: testPrompt,
    effort: "high",
    timeout: 60000,
  });

  if (result.success) {
    const wordCount = countWords(result.content);
    console.log(`✓ Generation successful`);
    console.log(`  Word count: ${wordCount}`);
    console.log(`  Session ID: ${result.sessionId}`);
    if (result.tokens) {
      console.log(
        `  Tokens: ${result.tokens.total} (prompt: ${result.tokens.prompt}, completion: ${result.tokens.completion})`,
      );
    }
    console.log("\nContent preview:");
    console.log(result.content.slice(0, 300) + "...\n");
  } else {
    console.error(`✗ Generation failed: ${result.error}`);
  }
}

async function testFullPipeline() {
  console.log("\n=== Testing Full Generation Pipeline ===\n");

  const db = getDb();

  // Get one cluster page
  const clusterResult = await db.query<{
    topic_slug: string;
    page_slug: string;
    slug: string;
    page: string;
    topic: string;
  }>(
    `
    SELECT topic_slug, page_slug, slug, page, topic
    FROM elongoat.cluster_pages
    ORDER BY max_volume DESC
    LIMIT 1
    `,
  );

  if (clusterResult.rows.length === 0) {
    console.log("No cluster pages found in database");
    return;
  }

  const page = clusterResult.rows[0];
  console.log(`Testing with page: "${page.page}" (${page.slug})`);

  // Get keywords
  const keywordResult = await db.query<{
    keyword: string;
    volume: number;
  }>(
    `
    SELECT keyword, volume
    FROM elongoat.cluster_keywords
    WHERE page_id = (SELECT id FROM elongoat.cluster_pages WHERE slug = $1)
    ORDER BY volume DESC
    LIMIT 5
    `,
    [page.slug],
  );

  console.log(
    `  Top keywords: ${keywordResult.rows.map((k) => k.keyword).join(", ")}`,
  );

  // Build RAG context
  const ragQuery = `${page.page} ${page.topic} ${keywordResult.rows.map((k) => k.keyword).join(" ")}`;
  const ragResult = await buildRagContext({
    query: ragQuery,
    includePaa: true,
    includeContentCache: false, // Skip cache to avoid circular reference
    includeClusters: false,
  });

  console.log(`  RAG contexts: ${ragResult.contexts.length}`);

  const ragFormatted = formatRagContexts(ragResult.contexts);

  const prompt = `
Write a 400-word SEO article about "${page.page}".

Topic: ${page.topic}
Keywords: ${keywordResult.rows.map((k) => k.keyword).join(", ")}

Reference context:
${ragFormatted.slice(0, 500)}

Structure:
1. ## Overview (100 words)
2. ## Key Points (200 words)
3. ## FAQ (100 words)

Write ONLY the markdown:
  `.trim();

  console.log("\nGenerating content...");

  const result = await generateWithCodex({
    prompt,
    effort: "high",
    timeout: 90000,
  });

  if (result.success) {
    const wordCount = countWords(result.content);
    console.log(`\n✓ Generation successful`);
    console.log(`  Word count: ${wordCount}`);
    console.log(`  Target: 400+ words`);
    console.log(
      `  Status: ${wordCount >= 400 ? "PASSED" : "WARNING (below target)"}`,
    );

    console.log("\nContent preview (first 500 chars):");
    console.log(result.content.slice(0, 500) + "...\n");
  } else {
    console.error(`\n✗ Generation failed: ${result.error}`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("ElonGoat RAG + Codex Generation Test Suite");
  console.log("=".repeat(60));

  try {
    // Test 1: RAG system
    await testRagSystem();

    // Test 2: Codex generation
    await testCodexGeneration();

    // Test 3: Full pipeline
    await testFullPipeline();

    console.log("=".repeat(60));
    console.log("✓ All tests completed");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n✗ Test suite failed:", error);
    process.exitCode = 1;
  } finally {
    const db = getDb();
    await db.end();
  }
}

main();
