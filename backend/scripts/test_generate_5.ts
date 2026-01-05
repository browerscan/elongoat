import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import { getDb } from "../lib/db";
import { getEnv } from "../lib/env";
import { vectorEngineChatComplete } from "../../src/lib/vectorengine";
import { buildRagContext, formatRagContexts } from "../../src/lib/rag";

type ClusterPage = {
  topicSlug: string;
  pageSlug: string;
  slug: string;
  page: string;
  topic: string;
  seedKeyword: string | null;
  topKeywords: Array<{
    keyword: string;
    volume: number;
    kd: number;
    intent?: string;
  }>;
};

const MIN_WORDS = 1200;
const env = getEnv();
const CONTENT_MODEL = env.VECTORENGINE_CONTENT_MODEL;
const MAX_TOKENS = 3000;
const TEST_LIMIT = 5; // Only generate 5 pages for testing

async function getTestPages(): Promise<ClusterPage[]> {
  const db = getDb();

  const pageResult = await db.query<{
    topic_slug: string;
    page_slug: string;
    slug: string;
    page: string;
    topic: string;
    seed_keyword: string | null;
  }>(
    `
    SELECT
      topic_slug,
      page_slug,
      slug,
      page,
      topic,
      seed_keyword
    FROM elongoat.cluster_pages
    ORDER BY max_volume DESC
    LIMIT $1
    `,
    [TEST_LIMIT],
  );

  const pages: ClusterPage[] = [];

  for (const row of pageResult.rows) {
    const keywordResult = await db.query<{
      keyword: string;
      volume: number;
      difficulty: number;
      intent: string | null;
    }>(
      `
      SELECT keyword, volume, difficulty, intent
      FROM elongoat.cluster_keywords
      WHERE page_id = (SELECT id FROM elongoat.cluster_pages WHERE slug = $1)
      ORDER BY volume DESC
      LIMIT 15
      `,
      [row.slug],
    );

    pages.push({
      topicSlug: row.topic_slug,
      pageSlug: row.page_slug,
      slug: row.slug,
      page: row.page,
      topic: row.topic,
      seedKeyword: row.seed_keyword,
      topKeywords: keywordResult.rows.map((k) => ({
        keyword: k.keyword,
        volume: k.volume,
        kd: k.difficulty,
        intent: k.intent ?? undefined,
      })),
    });
  }

  return pages;
}

async function buildPrompt(
  page: ClusterPage,
  vars: { age: number; children_count: number; net_worth: string; dob: string },
): Promise<{ system: string; user: string }> {
  const ragQuery = `${page.page} ${page.topic} ${page.topKeywords
    .slice(0, 5)
    .map((k) => k.keyword)
    .join(" ")}`;
  const ragResult = await buildRagContext({
    query: ragQuery,
    includePaa: true,
    includeContentCache: true,
    includeClusters: false,
  });

  const ragContextFormatted = formatRagContexts(ragResult.contexts);

  const keywordLines = page.topKeywords
    .map(
      (k) =>
        `- ${k.keyword} (vol ${k.volume}, kd ${k.kd}${k.intent ? `, intent ${k.intent}` : ""})`,
    )
    .join("\n");

  const system = `You are a senior SEO content writer and Elon Musk expert writing for an authoritative knowledge base.
You are NOT Elon Musk. You are an objective analyst and researcher.
Never invent private details or claim insider access. Only use public information.
Always cite timeframes for facts (e.g., "as of 2025", "in 2021").
Current date: ${new Date().toISOString().split("T")[0]}
Output: Markdown only (no meta-commentary).`;

  const user = `PAGE TITLE: ${page.page}
TOPIC HUB: ${page.topic}

DYNAMIC VARIABLES:
- Elon's age: ${vars.age}
- Children count: ${vars.children_count}
- Net worth: ${vars.net_worth}
- Date of birth: ${vars.dob}

TOP SEARCH QUERIES:
${keywordLines}

REFERENCE CONTEXT:
${ragContextFormatted}

---

Write a comprehensive, SEO-optimized article of AT LEAST 1200 words.

STRUCTURE:
1. ## TL;DR (3-5 bullet points with data and timeframes)
2. ## Introduction: Understanding "${page.page}" (150-200 words)
3. ## Historical Context & Background (200-300 words)
4. ## Deep Dive: Key Aspects (400-600 words in 4-6 sub-sections)
5. ## Current Status & Recent Developments (150-200 words)
6. ## Expert Analysis (100-150 words)
7. ## Frequently Asked Questions (6-8 Q&As, 250-350 words total)
8. ## How to Stay Updated (100-150 words)
9. ## Conclusion (80-100 words)

GUIDELINES:
- Clear, engaging language
- Cite timeframes for all facts
- Factual and objective
- Include specific numbers, dates, data points
- Naturally integrate keywords
- Use proper heading hierarchy (##, ###)
- Bullet points and lists for readability
- Active voice
- 1200-1500 words total

Write ONLY markdown content. Begin:`;

  return { system, user };
}

async function generateContent(
  page: ClusterPage,
  vars: { age: number; children_count: number; net_worth: string; dob: string },
): Promise<{
  success: boolean;
  content?: string;
  error?: string;
  wordCount?: number;
}> {
  try {
    const { system, user } = await buildPrompt(page, vars);

    const completion = await vectorEngineChatComplete({
      model: CONTENT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.35,
      maxTokens: MAX_TOKENS,
      timeout: 120000,
    });

    const content = completion.text.trim();
    const wordCount = content.split(/\s+/).length;

    return { success: true, content, wordCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("ElonGoat Test Generation (5 pages with VectorEngine)");
  console.log("=".repeat(70));

  // Check VectorEngine API key
  if (!env.VECTORENGINE_API_KEY) {
    throw new Error("VECTORENGINE_API_KEY not set in environment");
  }

  console.log(`Model: ${CONTENT_MODEL}`);
  console.log(`Max tokens: ${MAX_TOKENS}`);
  console.log(`Min words: ${MIN_WORDS}`);
  console.log();

  const db = getDb();

  // Load dynamic variables
  const varsResult = await db.query<{ key: string; value: string }>(
    "SELECT key, value FROM elongoat.variables WHERE key IN ('age', 'children_count', 'net_worth', 'dob')",
  );

  const vars = {
    age: 53,
    children_count: 12,
    net_worth: "$400B+",
    dob: "1971-06-28",
  };

  for (const row of varsResult.rows) {
    if (row.key === "age") vars.age = parseInt(row.value, 10);
    if (row.key === "children_count")
      vars.children_count = parseInt(row.value, 10);
    if (row.key === "net_worth") vars.net_worth = row.value;
    if (row.key === "dob") vars.dob = row.value;
  }

  console.log("Dynamic variables:");
  console.log(`  Age: ${vars.age}`);
  console.log(`  Children: ${vars.children_count}`);
  console.log(`  Net worth: ${vars.net_worth}`);
  console.log();

  // Get test pages
  console.log(`Loading top ${TEST_LIMIT} pages by volume...`);
  const pages = await getTestPages();
  console.log(`Found ${pages.length} pages to test\n`);

  const results: Array<{
    slug: string;
    page: string;
    wordCount: number;
    status: string;
    elapsed: string;
  }> = [];

  // Generate each page
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`[${i + 1}/${pages.length}] Generating: ${page.slug}`);
    console.log(`  Title: "${page.page}"`);
    console.log(`  Topic: ${page.topic}`);
    console.log(
      `  Keywords: ${page.topKeywords
        .slice(0, 3)
        .map((k) => k.keyword)
        .join(", ")}...`,
    );

    const startTime = Date.now();
    const result = await generateContent(page, vars);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success && result.content) {
      const wordCount = result.wordCount || 0;
      const status =
        wordCount >= MIN_WORDS
          ? "✓ PASS"
          : `⚠️  WARNING (${wordCount} < ${MIN_WORDS} words)`;

      console.log(`  ${status} - ${wordCount} words [${elapsed}s]`);

      results.push({
        slug: page.slug,
        page: page.page,
        wordCount,
        status: wordCount >= MIN_WORDS ? "PASS" : "WARNING",
        elapsed: `${elapsed}s`,
      });

      // Save preview to file
      const previewDir = path.join(
        process.cwd(),
        "data",
        "generated",
        "test_previews",
      );
      if (!existsSync(previewDir)) {
        await mkdir(previewDir, { recursive: true });
      }

      const previewFile = path.join(
        previewDir,
        `${page.slug.replace(/\//g, "_")}.md`,
      );
      await writeFile(previewFile, result.content, "utf-8");
      console.log(`  Preview saved: ${previewFile}`);
    } else {
      console.error(`  ✗ FAIL - ${result.error}`);
      results.push({
        slug: page.slug,
        page: page.page,
        wordCount: 0,
        status: "FAIL",
        elapsed: `${elapsed}s`,
      });
    }

    console.log();
  }

  // Summary
  console.log("=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));
  console.log();

  const passed = results.filter((r) => r.status === "PASS").length;
  const warned = results.filter((r) => r.status === "WARNING").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total: ${results.length}`);
  console.log(
    `Passed: ${passed} (${((passed / results.length) * 100).toFixed(0)}%)`,
  );
  console.log(`Warned: ${warned} (below word count)`);
  console.log(`Failed: ${failed}`);
  console.log();

  console.log("Results:");
  console.log("-".repeat(70));
  for (const r of results) {
    console.log(
      `${r.status.padEnd(10)} | ${r.wordCount.toString().padStart(4)} words | ${r.elapsed.padStart(6)} | ${r.slug}`,
    );
  }
  console.log();

  if (passed >= 4) {
    console.log("✓ Quality check PASSED - Ready for full batch generation!");
  } else {
    console.log(
      "⚠️  Quality check WARNED - Consider adjusting prompt or model settings",
    );
  }

  await db.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
