/**
 * Batch content generation with parallel execution and resume capability
 * Generates all 573 cluster pages using VectorEngine
 *
 * Usage:
 *   VECTORENGINE_API_KEY=... npx tsx backend/scripts/batch_generate.ts
 *
 * Options:
 *   CONCURRENCY=6       Number of parallel workers (default: 6)
 *   DELAY_MS=1000       Delay between batches (default: 1000)
 *   RESUME=true         Resume from previous run (default: true)
 *   START_FROM=0        Start from specific page index (default: 0)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { getEnv } from "../lib/env";

const env = getEnv();

// Types
type ClusterKeyword = {
  keyword: string;
  volume: number;
  kd: number;
  intent?: string;
};

type ClusterPage = {
  slug: string;
  topicSlug: string;
  topic: string;
  pageSlug: string;
  page: string;
  maxVolume: number;
  topKeywords: ClusterKeyword[];
};

type PaaQuestion = {
  slug: string;
  question: string;
  answer?: string | null;
  volume: number;
};

type GenerationResult = {
  slug: string;
  page: string;
  wordCount: number;
  status: "PASS" | "WARNING" | "FAIL";
  elapsed: string;
  error?: string;
  timestamp: string;
};

type ProgressState = {
  startedAt: string;
  lastUpdated: string;
  completed: string[];
  failed: string[];
  results: GenerationResult[];
};

// VectorEngine API call
async function vectorEngineChatComplete(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ success: boolean; text: string; error?: string }> {
  const apiKey = env.VECTORENGINE_API_KEY;
  const baseUrl = env.VECTORENGINE_BASE_URL;

  if (!apiKey) {
    return { success: false, text: "", error: "VECTORENGINE_API_KEY not set" };
  }

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        text: "",
        error: `API error ${response.status}: ${errText}`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";

    return { success: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, text: "", error: msg };
  }
}

// Load indexes
async function loadClusterIndex(): Promise<{ pages: ClusterPage[] }> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "generated",
    "cluster-index.json",
  );
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function loadPaaIndex(): Promise<{ questions: PaaQuestion[] }> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "generated",
    "paa-index.json",
  );
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

// Find related PAA for context
function findRelatedPaa(
  page: ClusterPage,
  paaQuestions: PaaQuestion[],
  limit = 5,
): PaaQuestion[] {
  const pageWords = new Set(
    (
      page.page +
      " " +
      page.topic +
      " " +
      page.topKeywords.map((k) => k.keyword).join(" ")
    )
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

  const scored = paaQuestions.map((q) => {
    const qWords = q.question.toLowerCase().split(/\s+/);
    const matchCount = qWords.filter((w) => pageWords.has(w)).length;
    return { question: q, score: matchCount };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.question);
}

function buildRagContext(relatedPaa: PaaQuestion[]): string {
  if (relatedPaa.length === 0) return "(No related Q&A found)";
  return relatedPaa
    .map((q) => {
      const answer = q.answer
        ? q.answer.slice(0, 300) + "..."
        : "(No answer available)";
      return `Q: ${q.question}\nA: ${answer}`;
    })
    .join("\n\n");
}

// Dynamic variables
const DYNAMIC_VARS = {
  age: Math.floor(
    (Date.now() - new Date("1971-06-28").getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  ),
  children_count: 14,
  net_worth: "$400B+ (fluctuates with markets)",
  dob: "June 28, 1971",
};

function buildPrompt(page: ClusterPage, ragContext: string): string {
  const keywordLines = page.topKeywords
    .slice(0, 15)
    .map(
      (k) =>
        `- ${k.keyword} (vol ${k.volume}, kd ${k.kd}${k.intent ? `, intent ${k.intent}` : ""})`,
    )
    .join("\n");

  return `You are a senior SEO content writer and Elon Musk expert writing for an authoritative knowledge base.

PAGE TITLE: ${page.page}
TOPIC HUB: ${page.topic}
CURRENT DATE: ${new Date().toISOString().split("T")[0]}

DYNAMIC VARIABLES:
- Elon's age: ${DYNAMIC_VARS.age}
- Children count: ${DYNAMIC_VARS.children_count}
- Net worth: ${DYNAMIC_VARS.net_worth}
- Date of birth: ${DYNAMIC_VARS.dob}

TOP SEARCH QUERIES (integrate these naturally):
${keywordLines}

REFERENCE CONTEXT:
${ragContext}

---

TASK: Write a comprehensive, SEO-optimized article of AT LEAST 1200 words.

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
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

// Configuration
const CONFIG = {
  model: env.VECTORENGINE_CONTENT_MODEL,
  maxTokens: 3000,
  temperature: 0.35,
  minWords: 1200,
  concurrency: env.CONCURRENCY,
  delayMs: env.DELAY_MS ?? 1000,
  resume: env.RESUME,
  startFrom: env.START_FROM,
};

const OUTPUT_DIR = path.join(process.cwd(), "data", "generated", "content");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "_batch_progress.json");

async function loadProgress(): Promise<ProgressState> {
  if (CONFIG.resume && existsSync(PROGRESS_FILE)) {
    const raw = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  }
  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    completed: [],
    failed: [],
    results: [],
  };
}

async function saveProgress(state: ProgressState): Promise<void> {
  state.lastUpdated = new Date().toISOString();
  await writeFile(PROGRESS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function generatePage(
  page: ClusterPage,
  paaQuestions: PaaQuestion[],
): Promise<GenerationResult> {
  const startTime = Date.now();
  const relatedPaa = findRelatedPaa(page, paaQuestions);
  const ragContext = buildRagContext(relatedPaa);
  const prompt = buildPrompt(page, ragContext);

  const result = await vectorEngineChatComplete({
    model: CONFIG.model,
    messages: [{ role: "user", content: prompt }],
    temperature: CONFIG.temperature,
    maxTokens: CONFIG.maxTokens,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.success && result.text) {
    const wordCount = countWords(result.text);
    const status = wordCount >= CONFIG.minWords ? "PASS" : "WARNING";

    const safeSlug = page.slug.replace(/\//g, "_");
    const outputFile = path.join(OUTPUT_DIR, `${safeSlug}.md`);
    await writeFile(outputFile, result.text, "utf-8");

    return {
      slug: page.slug,
      page: page.page,
      wordCount,
      status,
      elapsed: `${elapsed}s`,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    slug: page.slug,
    page: page.page,
    wordCount: 0,
    status: "FAIL",
    elapsed: `${elapsed}s`,
    error: result.error,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("ElonGoat Batch Content Generation");
  console.log("=".repeat(70));
  console.log();

  if (!env.VECTORENGINE_API_KEY) {
    console.error("ERROR: VECTORENGINE_API_KEY not set");
    process.exit(1);
  }

  console.log(`Model: ${CONFIG.model}`);
  console.log(`Concurrency: ${CONFIG.concurrency} parallel workers`);
  console.log(`Min words: ${CONFIG.minWords}`);
  console.log(`Resume mode: ${CONFIG.resume}`);
  console.log();

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Load indexes
  console.log("Loading indexes...");
  const clusterIndex = await loadClusterIndex();
  const paaIndex = await loadPaaIndex();
  console.log(`  Total cluster pages: ${clusterIndex.pages.length}`);
  console.log(`  Total PAA questions: ${paaIndex.questions.length}`);
  console.log();

  // Load progress
  const state = await loadProgress();
  const completedSet = new Set(state.completed);
  const failedSet = new Set(state.failed);

  // Sort by volume and filter out completed
  const sortedPages = [...clusterIndex.pages]
    .sort((a, b) => b.maxVolume - a.maxVolume)
    .slice(CONFIG.startFrom);

  const pagesToGenerate = sortedPages.filter(
    (p) => !completedSet.has(p.slug) && !failedSet.has(p.slug),
  );

  console.log(`Already completed: ${completedSet.size}`);
  console.log(`Previously failed: ${failedSet.size}`);
  console.log(`Remaining to generate: ${pagesToGenerate.length}`);
  console.log();

  if (pagesToGenerate.length === 0) {
    console.log("✓ All pages already generated!");
    return;
  }

  // Process in batches
  let processed = 0;
  const total = pagesToGenerate.length;
  const startTime = Date.now();

  for (let i = 0; i < pagesToGenerate.length; i += CONFIG.concurrency) {
    const batch = pagesToGenerate.slice(i, i + CONFIG.concurrency);

    console.log(
      `\n--- Batch ${Math.floor(i / CONFIG.concurrency) + 1} (${batch.length} pages) ---`,
    );

    const promises = batch.map(async (page, idx) => {
      const globalIdx = completedSet.size + i + idx + 1;
      console.log(
        `[${globalIdx}/${clusterIndex.pages.length}] Starting: ${page.slug}`,
      );

      const result = await generatePage(page, paaIndex.questions);

      const icon =
        result.status === "PASS"
          ? "✓"
          : result.status === "WARNING"
            ? "⚠️"
            : "✗";
      console.log(
        `[${globalIdx}] ${icon} ${result.wordCount} words [${result.elapsed}] ${page.slug}`,
      );

      return result;
    });

    const results = await Promise.all(promises);

    // Update state
    for (const result of results) {
      state.results.push(result);
      if (result.status === "FAIL") {
        state.failed.push(result.slug);
        failedSet.add(result.slug);
      } else {
        state.completed.push(result.slug);
        completedSet.add(result.slug);
      }
    }

    processed += batch.length;
    await saveProgress(state);

    // Progress update
    const elapsedTotal = (Date.now() - startTime) / 1000;
    const rate = processed / elapsedTotal;
    const remaining = (total - processed) / rate;
    console.log(
      `\nProgress: ${completedSet.size}/${clusterIndex.pages.length} (${((completedSet.size / clusterIndex.pages.length) * 100).toFixed(1)}%)`,
    );
    console.log(`ETA: ${Math.ceil(remaining / 60)} minutes remaining`);

    // Delay between batches
    if (i + CONFIG.concurrency < pagesToGenerate.length) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.delayMs));
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("BATCH GENERATION COMPLETE");
  console.log("=".repeat(70));
  console.log();

  const passed = state.results.filter((r) => r.status === "PASS").length;
  const warned = state.results.filter((r) => r.status === "WARNING").length;
  const failed = state.results.filter((r) => r.status === "FAIL").length;

  console.log(`Total generated: ${state.results.length}`);
  console.log(
    `Passed: ${passed} (${((passed / state.results.length) * 100).toFixed(1)}%)`,
  );
  console.log(`Warned: ${warned} (below ${CONFIG.minWords} words)`);
  console.log(`Failed: ${failed}`);
  console.log();
  console.log(`Progress saved to: ${PROGRESS_FILE}`);
  console.log(`Content files in: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
