/**
 * Standalone content generation script
 * Works entirely from local JSON indexes - no database required
 * Uses VectorEngine (claude-sonnet-4-5) for high-quality 1200+ word articles
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

// Types from indexes.ts
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
  pageType?: string | null;
  seedKeyword?: string | null;
  keywordCount: number;
  maxVolume: number;
  totalVolume: number;
  topKeywords: ClusterKeyword[];
};

type PaaQuestion = {
  slug: string;
  question: string;
  answer?: string | null;
  volume: number;
};

type ClusterIndex = {
  generatedAt: string;
  pages: ClusterPage[];
};

type PaaIndex = {
  generatedAt: string;
  questions: PaaQuestion[];
};

// VectorEngine API call
async function vectorEngineChatComplete(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ success: boolean; text: string; error?: string }> {
  const apiKey = process.env.VECTORENGINE_API_KEY;
  const baseUrl =
    process.env.VECTORENGINE_BASE_URL || "https://api.vectorengine.ai";

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

// Load JSON indexes
async function loadClusterIndex(): Promise<ClusterIndex> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "generated",
    "cluster-index.json",
  );
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as ClusterIndex;
}

async function loadPaaIndex(): Promise<PaaIndex> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "generated",
    "paa-index.json",
  );
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as PaaIndex;
}

// Find related PAA questions for RAG context
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

// Build RAG context from PAA
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

// Build prompt for content generation
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

REFERENCE CONTEXT (use this to inform your writing):
${ragContext}

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
}

// Count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

// Configuration
const CONFIG = {
  model: process.env.VECTORENGINE_CONTENT_MODEL || "claude-sonnet-4-5-20250929",
  maxTokens: 3000,
  temperature: 0.35,
  minWords: 1200,
  testLimit: parseInt(process.env.TEST_LIMIT || "5", 10),
  batchMode: process.env.BATCH_MODE === "true",
  delayMs: parseInt(process.env.DELAY_MS || "2000", 10),
};

async function main() {
  console.log("=".repeat(70));
  console.log("ElonGoat Local Content Generation");
  console.log("=".repeat(70));
  console.log();

  // Check API key
  if (!process.env.VECTORENGINE_API_KEY) {
    console.error("ERROR: VECTORENGINE_API_KEY not set");
    console.error("Set it in .env or environment");
    process.exit(1);
  }

  console.log(`Model: ${CONFIG.model}`);
  console.log(`Max tokens: ${CONFIG.maxTokens}`);
  console.log(`Min words: ${CONFIG.minWords}`);
  console.log(
    `Mode: ${CONFIG.batchMode ? "BATCH (all pages)" : `TEST (${CONFIG.testLimit} pages)`}`,
  );
  console.log();

  // Load indexes
  console.log("Loading indexes...");
  const clusterIndex = await loadClusterIndex();
  const paaIndex = await loadPaaIndex();
  console.log(`  Loaded ${clusterIndex.pages.length} cluster pages`);
  console.log(`  Loaded ${paaIndex.questions.length} PAA questions`);
  console.log();

  // Select pages to generate
  const sortedPages = [...clusterIndex.pages].sort(
    (a, b) => b.maxVolume - a.maxVolume,
  );
  const pagesToGenerate = CONFIG.batchMode
    ? sortedPages
    : sortedPages.slice(0, CONFIG.testLimit);

  console.log(`Generating ${pagesToGenerate.length} pages...`);
  console.log();

  // Output directory
  const outputDir = path.join(process.cwd(), "data", "generated", "content");
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const results: Array<{
    slug: string;
    page: string;
    wordCount: number;
    status: "PASS" | "WARNING" | "FAIL";
    elapsed: string;
    error?: string;
  }> = [];

  // Generate each page
  for (let i = 0; i < pagesToGenerate.length; i++) {
    const page = pagesToGenerate[i];
    console.log(`[${i + 1}/${pagesToGenerate.length}] ${page.slug}`);
    console.log(`  Title: "${page.page}"`);
    console.log(`  Topic: ${page.topic}`);
    console.log(
      `  Top keywords: ${page.topKeywords
        .slice(0, 3)
        .map((k) => k.keyword)
        .join(", ")}...`,
    );

    const startTime = Date.now();

    // Find related PAA for context
    const relatedPaa = findRelatedPaa(page, paaIndex.questions);
    const ragContext = buildRagContext(relatedPaa);

    // Build prompt and generate
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

      console.log(
        `  ${status === "PASS" ? "✓" : "⚠️"} ${wordCount} words [${elapsed}s]`,
      );

      // Save to file
      const safeSlug = page.slug.replace(/\//g, "_");
      const outputFile = path.join(outputDir, `${safeSlug}.md`);
      await writeFile(outputFile, result.text, "utf-8");
      console.log(`  Saved: ${outputFile}`);

      results.push({
        slug: page.slug,
        page: page.page,
        wordCount,
        status,
        elapsed: `${elapsed}s`,
      });
    } else {
      console.log(`  ✗ FAIL: ${result.error}`);
      results.push({
        slug: page.slug,
        page: page.page,
        wordCount: 0,
        status: "FAIL",
        elapsed: `${elapsed}s`,
        error: result.error,
      });
    }

    console.log();

    // Delay between requests
    if (i < pagesToGenerate.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.delayMs));
    }
  }

  // Save results summary
  const summaryFile = path.join(outputDir, "_generation_results.json");
  await writeFile(
    summaryFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: CONFIG.model,
        totalPages: results.length,
        passed: results.filter((r) => r.status === "PASS").length,
        warned: results.filter((r) => r.status === "WARNING").length,
        failed: results.filter((r) => r.status === "FAIL").length,
        results,
      },
      null,
      2,
    ),
    "utf-8",
  );

  // Summary
  console.log("=".repeat(70));
  console.log("GENERATION SUMMARY");
  console.log("=".repeat(70));
  console.log();

  const passed = results.filter((r) => r.status === "PASS").length;
  const warned = results.filter((r) => r.status === "WARNING").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total: ${results.length}`);
  console.log(
    `Passed: ${passed} (${((passed / results.length) * 100).toFixed(0)}%)`,
  );
  console.log(`Warned: ${warned} (below ${CONFIG.minWords} words)`);
  console.log(`Failed: ${failed}`);
  console.log();
  console.log(`Results saved to: ${summaryFile}`);
  console.log(`Content files in: ${outputDir}`);
  console.log();

  if (passed / results.length >= 0.8) {
    console.log("✓ Quality check PASSED - Ready for batch generation!");
    console.log("  Run with BATCH_MODE=true to generate all pages");
  } else {
    console.log("⚠️ Quality check needs attention - review generated content");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
