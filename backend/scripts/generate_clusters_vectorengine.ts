import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import { getDb } from "../lib/db";
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
const BATCH_SIZE = 3; // Conservative: 3 parallel requests
const BATCH_DELAY_MS = 3000; // 3 seconds between batches
const CONTENT_MODEL =
  process.env.VECTORENGINE_CONTENT_MODEL || "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 3000; // Ensure enough tokens for 1200+ words

const PROGRESS_FILE = path.join(
  process.cwd(),
  "data",
  "generated",
  "cluster_generation_progress.json",
);

type Progress = {
  totalPages: number;
  completed: number;
  failed: string[];
  lastUpdated: string;
  completedSlugs: Set<string>;
};

async function loadProgress(): Promise<Progress> {
  if (existsSync(PROGRESS_FILE)) {
    const data = JSON.parse(await readFile(PROGRESS_FILE, "utf-8"));
    return {
      ...data,
      completedSlugs: new Set(data.completedSlugs || []),
    };
  }
  return {
    totalPages: 0,
    completed: 0,
    failed: [],
    lastUpdated: new Date().toISOString(),
    completedSlugs: new Set(),
  };
}

async function saveProgress(progress: Progress): Promise<void> {
  const dir = path.dirname(PROGRESS_FILE);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(
    PROGRESS_FILE,
    JSON.stringify(
      {
        ...progress,
        completedSlugs: Array.from(progress.completedSlugs),
      },
      null,
      2,
    ),
  );
}

async function getClusterPages(): Promise<ClusterPage[]> {
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
    ORDER BY max_volume DESC, slug
    `,
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

async function getAlreadyGenerated(): Promise<Set<string>> {
  const db = getDb();
  const result = await db.query<{ slug: string }>(
    `
    SELECT slug
    FROM elongoat.content_cache
    WHERE kind = 'cluster_page'
    `,
  );

  return new Set(result.rows.map((r) => r.slug));
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

TOP SEARCH QUERIES (integrate these naturally):
${keywordLines}

REFERENCE CONTEXT:
${ragContextFormatted}

---

TASK: Write a comprehensive, SEO-optimized article of AT LEAST 1200 words.

STRUCTURE (follow strictly):
1. ## TL;DR
   - 3-5 bullet points summarizing key information
   - Include specific data points and timeframes

2. ## Introduction: Understanding "${page.page}"
   - What this topic means in the context of Elon Musk
   - Why people search for this
   - Current relevance (as of ${new Date().getFullYear()})
   - 150-200 words

3. ## Historical Context & Background
   - Timeline of key events and developments
   - How this topic evolved over time
   - Important milestones with specific dates
   - 200-300 words

4. ## Deep Dive: Key Aspects
   - Break down into 4-6 major sub-sections
   - Each sub-section should be 100-150 words
   - Cover different angles from the search queries
   - Include specific examples, numbers, and facts
   - Total: 400-600 words

5. ## Current Status & Recent Developments
   - What's happening now (2025-2026)
   - Recent news and updates
   - Current impact and implications
   - 150-200 words

6. ## Expert Analysis
   - Industry perspective
   - Challenges and opportunities
   - Future outlook
   - 100-150 words

7. ## Frequently Asked Questions
   - 6-8 questions with detailed answers
   - Each answer should be 40-60 words
   - Total: 250-350 words

8. ## How to Stay Updated
   - Reliable sources to follow
   - Official channels and resources
   - Verification tips
   - 100-150 words

9. ## Conclusion
   - Summarize key takeaways
   - Final thoughts
   - 80-100 words

WRITING GUIDELINES:
- Use clear, engaging language (avoid jargon unless explained)
- Cite timeframes for all time-sensitive information
- Be factual and objective (not promotional)
- Include specific numbers, dates, and data points when available
- Naturally integrate keywords from the search queries
- Add proper heading hierarchy (##, ###)
- Use bullet points and lists for readability
- Write in active voice
- Aim for 1200-1500 words total

CRITICAL: This is for a knowledge base, NOT a blog. Focus on:
- Comprehensive information coverage
- Factual accuracy with timeframes
- Answering user intent behind search queries
- Being a definitive resource on this topic

Write ONLY the markdown content (no meta-commentary). Begin now:`;

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
      timeout: 120000, // 2 minutes
    });

    const content = completion.text.trim();
    const wordCount = content.split(/\s+/).length;

    return { success: true, content, wordCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

async function saveToCacheTable(
  slug: string,
  contentMd: string,
  model: string,
  ragContexts: number,
  wordCount: number,
): Promise<void> {
  const db = getDb();

  const cacheKey = `cluster_page:${slug}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.query(
    `
    INSERT INTO elongoat.content_cache (cache_key, kind, slug, model, content_md, sources, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (cache_key) DO UPDATE SET
      content_md = EXCLUDED.content_md,
      model = EXCLUDED.model,
      sources = EXCLUDED.sources,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    `,
    [
      cacheKey,
      "cluster_page",
      slug,
      model,
      contentMd,
      JSON.stringify({
        kind: "cluster_page",
        slug,
        generatedAt: new Date().toISOString(),
        ragContexts,
        wordCount,
      }),
      expiresAt,
    ],
  );
}

async function main() {
  console.log(
    "[generate-clusters-ve] Starting batch generation with VectorEngine...",
  );

  // Check VectorEngine API key
  if (!process.env.VECTORENGINE_API_KEY) {
    throw new Error("VECTORENGINE_API_KEY not set in environment");
  }

  // Load dynamic variables
  const db = getDb();
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

  // Load progress
  let progress = await loadProgress();

  // Get all pages
  console.log("[generate-clusters-ve] Loading cluster pages from database...");
  const allPages = await getClusterPages();
  progress.totalPages = allPages.length;

  console.log(`[generate-clusters-ve] Total pages: ${allPages.length}`);

  // Get already generated
  const alreadyGenerated = await getAlreadyGenerated();
  console.log(
    `[generate-clusters-ve] Already generated: ${alreadyGenerated.size}`,
  );

  // Filter out already generated
  const toGenerate = allPages.filter(
    (p) =>
      !alreadyGenerated.has(p.slug) && !progress.completedSlugs.has(p.slug),
  );

  console.log(
    `[generate-clusters-ve] Remaining to generate: ${toGenerate.length}`,
  );

  if (toGenerate.length === 0) {
    console.log("[generate-clusters-ve] All pages already generated!");
    await db.end();
    return;
  }

  // Process in batches
  let batchNum = 0;
  for (let i = 0; i < toGenerate.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = toGenerate.slice(i, i + BATCH_SIZE);

    console.log(
      `\n[generate-clusters-ve] Batch ${batchNum}: Processing ${batch.length} pages (${i + 1}-${i + batch.length} of ${toGenerate.length})`,
    );

    // Generate in parallel (limited by BATCH_SIZE)
    const promises = batch.map(async (page) => {
      const startTime = Date.now();
      const result = await generateContent(page, vars);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      return { page, result, elapsed };
    });

    const results = await Promise.all(promises);

    // Save results
    for (const { page, result, elapsed } of results) {
      if (result.success && result.content) {
        const wordCount = result.wordCount || 0;

        if (wordCount < MIN_WORDS) {
          console.warn(
            `  ⚠️  ${page.slug}: Only ${wordCount} words (target: ${MIN_WORDS}) [${elapsed}s]`,
          );
        } else {
          console.log(`  ✓ ${page.slug}: ${wordCount} words [${elapsed}s]`);
        }

        try {
          await saveToCacheTable(
            page.slug,
            result.content,
            CONTENT_MODEL,
            0,
            wordCount,
          );
          progress.completed++;
          progress.completedSlugs.add(page.slug);
        } catch (saveError) {
          console.error(`  ✗ ${page.slug}: Failed to save - ${saveError}`);
          progress.failed.push(page.slug);
        }
      } else {
        console.error(`  ✗ ${page.slug}: Generation failed - ${result.error}`);
        progress.failed.push(page.slug);
      }
    }

    // Save progress after each batch
    progress.lastUpdated = new Date().toISOString();
    await saveProgress(progress);

    console.log(
      `[generate-clusters-ve] Progress: ${progress.completed}/${progress.totalPages} (${((progress.completed / progress.totalPages) * 100).toFixed(1)}%)`,
    );

    // Add delay between batches to avoid rate limits
    if (i + BATCH_SIZE < toGenerate.length) {
      console.log(
        `[generate-clusters-ve] Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`,
      );
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log("\n[generate-clusters-ve] ✓ Batch generation complete!");
  console.log(`  Total: ${progress.completed}/${progress.totalPages}`);
  console.log(`  Failed: ${progress.failed.length}`);

  if (progress.failed.length > 0) {
    console.log("\nFailed slugs:");
    for (const slug of progress.failed) {
      console.log(`  - ${slug}`);
    }
  }

  await db.end();
}

main().catch((err) => {
  console.error("[generate-clusters-ve] Fatal error:", err);
  process.exitCode = 1;
});
