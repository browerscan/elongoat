import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import { getDb } from "../lib/db";
import { batchGenerateWithCodex } from "../lib/codex";
import { buildRagContext, formatRagContexts } from "../../src/lib/rag";

type PaaQuestion = {
  slug: string;
  question: string;
  answer: string | null;
  volume: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

const MIN_WORDS = 800;
const BATCH_SIZE = 6;
const PROGRESS_FILE = path.join(
  process.cwd(),
  "data",
  "generated",
  "question_generation_progress.json",
);

type Progress = {
  totalQuestions: number;
  completed: number;
  failed: string[];
  skipped: number;
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
    totalQuestions: 0,
    completed: 0,
    failed: [],
    skipped: 0,
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

async function getPaaQuestions(params: {
  minVolume?: number;
  limit?: number;
}): Promise<PaaQuestion[]> {
  const db = getDb();
  const minVolume = params.minVolume ?? 0;
  const limit = params.limit ?? 10000;

  const result = await db.query<{
    slug: string;
    question: string;
    answer: string | null;
    volume: number;
    source_url: string | null;
    source_title: string | null;
  }>(
    `
    SELECT slug, question, answer, volume, source_url, source_title
    FROM elongoat.paa_tree
    WHERE volume >= $1
    ORDER BY volume DESC
    LIMIT $2
    `,
    [minVolume, limit],
  );

  return result.rows.map((r) => ({
    slug: r.slug,
    question: r.question,
    answer: r.answer,
    volume: r.volume,
    sourceUrl: r.source_url,
    sourceTitle: r.source_title,
  }));
}

async function getAlreadyGenerated(): Promise<Set<string>> {
  const db = getDb();
  const result = await db.query<{ slug: string }>(
    `
    SELECT slug
    FROM elongoat.content_cache
    WHERE kind = 'paa_question'
    `,
  );

  return new Set(result.rows.map((r) => r.slug));
}

async function buildPrompt(
  question: PaaQuestion,
  vars: { age: number; children_count: number; net_worth: string; dob: string },
): Promise<string> {
  // Build RAG context
  const ragResult = await buildRagContext({
    query: question.question,
    includePaa: true,
    includeContentCache: true,
    includeClusters: true,
  });

  const ragContextFormatted = formatRagContexts(ragResult.contexts);

  return `
You are a research writer specializing in Elon Musk and his ventures.

QUESTION: ${question.question}
${question.answer ? `EXISTING SNIPPET: ${question.answer}` : ""}
${question.sourceUrl ? `SOURCE: ${question.sourceUrl}` : ""}
CURRENT DATE: ${new Date().toISOString().split("T")[0]}

DYNAMIC VARIABLES:
- Elon's age: ${vars.age}
- Children count: ${vars.children_count}
- Net worth: ${vars.net_worth}
- Date of birth: ${vars.dob}

REFERENCE CONTEXT:
${ragContextFormatted}

---

TASK: Write a comprehensive answer of AT LEAST 800 words.

STRUCTURE:
1. ## Quick Answer
   - Direct answer in 2-3 sentences
   - Include key timeframe

2. ## Detailed Explanation
   - Comprehensive breakdown (300-400 words)
   - Multiple paragraphs covering different aspects
   - Specific examples and data points
   - Timeline of relevant events

3. ## Important Context
   - Background information
   - Why this matters
   - Related considerations
   - 150-200 words

4. ## Common Questions & Misconceptions
   - Address related questions
   - Clarify common misunderstandings
   - 4-5 items with explanations
   - 150-200 words

5. ## How to Verify This Information
   - Reliable sources to check
   - Official channels
   - What to look for
   - 100-150 words

6. ## Freshness & Updates
   - When this information might change
   - How to stay current
   - 50-100 words

GUIDELINES:
- Be factual and objective
- Always include timeframes for time-sensitive info
- Cite specific dates, numbers, and sources
- Avoid speculation unless clearly marked as such
- Write in clear, accessible language
- Target 800-1000 words total

Write ONLY the markdown content. Begin:
`.trim();
}

async function saveToCacheTable(
  slug: string,
  contentMd: string,
  model: string,
  ragContexts: number,
  wordCount: number,
): Promise<void> {
  const db = getDb();

  const cacheKey = `paa_question:${slug}`;
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
      "paa_question",
      slug,
      model,
      contentMd,
      JSON.stringify({
        kind: "paa_question",
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
  // Parse CLI args
  const args = process.argv.slice(2);
  let minVolume = 0;
  let limit = 1000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--min-volume" && args[i + 1]) {
      minVolume = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log("[generate-questions] Starting batch generation...");
  console.log(`  Min volume: ${minVolume}`);
  console.log(`  Limit: ${limit}`);

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

  // Get all questions
  console.log("[generate-questions] Loading PAA questions from database...");
  const allQuestions = await getPaaQuestions({ minVolume, limit });
  progress.totalQuestions = allQuestions.length;

  console.log(`[generate-questions] Total questions: ${allQuestions.length}`);

  // Get already generated
  const alreadyGenerated = await getAlreadyGenerated();
  console.log(
    `[generate-questions] Already generated: ${alreadyGenerated.size}`,
  );

  // Filter out already generated
  const toGenerate = allQuestions.filter(
    (q) =>
      !alreadyGenerated.has(q.slug) && !progress.completedSlugs.has(q.slug),
  );

  console.log(
    `[generate-questions] Remaining to generate: ${toGenerate.length}`,
  );

  if (toGenerate.length === 0) {
    console.log("[generate-questions] All questions already generated!");
    await db.end();
    return;
  }

  // Process in batches
  let batchNum = 0;
  for (let i = 0; i < toGenerate.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = toGenerate.slice(i, i + BATCH_SIZE);

    console.log(
      `\n[generate-questions] Batch ${batchNum}: Processing ${batch.length} questions (${i + 1}-${i + batch.length} of ${toGenerate.length})`,
    );

    // Build tasks
    const tasks = await Promise.all(
      batch.map(async (question) => ({
        id: question.slug,
        prompt: await buildPrompt(question, vars),
        effort: "high" as const,
      })),
    );

    // Generate in parallel
    const results = await batchGenerateWithCodex(tasks, {
      concurrency: BATCH_SIZE,
      onProgress: (completed, total, taskId) => {
        console.log(`  [${completed}/${total}] Generated: ${taskId}`);
      },
    });

    // Save results
    for (const [slug, result] of results) {
      if (result.success && result.content) {
        const wordCount = result.content.trim().split(/\s+/).length;

        if (wordCount < MIN_WORDS) {
          console.warn(
            `  ⚠️  ${slug}: Only ${wordCount} words (target: ${MIN_WORDS})`,
          );
        } else {
          console.log(`  ✓ ${slug}: ${wordCount} words`);
        }

        try {
          await saveToCacheTable(
            slug,
            result.content,
            "codex-high",
            0,
            wordCount,
          );
          progress.completed++;
          progress.completedSlugs.add(slug);
        } catch (saveError) {
          console.error(`  ✗ ${slug}: Failed to save - ${saveError}`);
          progress.failed.push(slug);
        }
      } else {
        console.error(`  ✗ ${slug}: Generation failed - ${result.error}`);
        progress.failed.push(slug);
      }
    }

    // Save progress after each batch
    progress.lastUpdated = new Date().toISOString();
    await saveProgress(progress);

    console.log(
      `[generate-questions] Progress: ${progress.completed}/${progress.totalQuestions} (${((progress.completed / progress.totalQuestions) * 100).toFixed(1)}%)`,
    );

    // Add a small delay between batches
    if (i + BATCH_SIZE < toGenerate.length) {
      console.log("[generate-questions] Waiting 5s before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log("\n[generate-questions] ✓ Batch generation complete!");
  console.log(`  Total: ${progress.completed}/${progress.totalQuestions}`);
  console.log(`  Failed: ${progress.failed.length}`);

  if (progress.failed.length > 0) {
    console.log("\nFailed slugs:");
    for (const slug of progress.failed.slice(0, 20)) {
      console.log(`  - ${slug}`);
    }
    if (progress.failed.length > 20) {
      console.log(`  ... and ${progress.failed.length - 20} more`);
    }
  }

  await db.end();
}

main().catch((err) => {
  console.error("[generate-questions] Fatal error:", err);
  process.exitCode = 1;
});
