// Content generation is server-only by nature

import { findPage, findPaaQuestion } from "@/lib/indexes";
import { setCachedContent } from "@/lib/contentCache";
import { getDynamicVariables } from "@/lib/variables";
import { buildRagContext, formatRagContexts } from "@/lib/rag";
import { vectorEngineChatComplete } from "@/lib/vectorengine";

// Word count utilities
function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function validateWordCount(
  content: string,
  minWords: number,
): { valid: boolean; actual: number; message?: string } {
  const actual = countWords(content);
  const valid = actual >= minWords;
  return {
    valid,
    actual,
    message: valid
      ? undefined
      : `Content has ${actual} words, requires at least ${minWords}`,
  };
}

const MIN_WORDS_CLUSTER = 1200;
const MIN_WORDS_PAA = 800;

/**
 * Generate content with retry logic for word count validation
 * If first attempt is too short, retry with higher maxTokens
 */
async function generateWithRetry(params: {
  prompt: string;
  model: string;
  minWords: number;
  initialMaxTokens: number;
  retryMaxTokens: number;
  slug: string;
  kind: "cluster" | "paa";
}): Promise<{ contentMd: string; wordCount: number; model: string }> {
  let contentMd = "";
  let wordCount = 0;
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    const maxTokens =
      attempt === 0 ? params.initialMaxTokens : params.retryMaxTokens;

    const result = await vectorEngineChatComplete({
      model: params.model,
      messages: [{ role: "user", content: params.prompt }],
      temperature: 0.35,
      maxTokens,
    });

    contentMd = result.text.trim();
    wordCount = countWords(contentMd);

    const validation = validateWordCount(contentMd, params.minWords);

    if (validation.valid) {
      // Success - log word count achieved
      console.info(
        `[contentGen] ${params.kind.toUpperCase()} ${params.slug}: ${wordCount} words (attempt ${attempt + 1})`,
      );
      break;
    }

    attempt++;
    if (attempt < maxAttempts) {
      console.warn(
        `[contentGen] ${params.kind.toUpperCase()} ${params.slug}: ${validation.message} - retrying with higher token limit...`,
      );
    } else {
      console.warn(
        `[contentGen] ${params.kind.toUpperCase()} ${params.slug}: ${validation.message} (final attempt)`,
      );
    }
  }

  return { contentMd, wordCount, model: params.model };
}

/**
 * Generate cluster page content using RAG + Codex
 */
export async function generateClusterPageContentEnhanced(params: {
  topicSlug: string;
  pageSlug: string;
  ttlSeconds?: number;
}): Promise<{
  contentMd: string;
  model: string;
  wordCount: number;
  ragContextsUsed: number;
}> {
  const slug = `${params.topicSlug}/${params.pageSlug}`;
  const page = await findPage(params.topicSlug, params.pageSlug);
  if (!page) throw new Error("Cluster page not found");

  const vars = await getDynamicVariables();

  // Build RAG context
  const ragQuery = `${page.page} ${page.topic} ${page.topKeywords
    .slice(0, 5)
    .map((k) => k.keyword)
    .join(" ")}`;
  const ragResult = await buildRagContext({
    query: ragQuery,
    includePaa: true,
    includeContentCache: true,
    includeClusters: false, // Don't include cluster context for cluster generation
  });

  const ragContextFormatted = formatRagContexts(ragResult.contexts);

  // Build keyword list
  const keywordLines = page.topKeywords
    .slice(0, 15)
    .map(
      (k) =>
        `- ${k.keyword} (vol ${k.volume}, kd ${k.kd}${k.intent ? `, intent ${k.intent}` : ""})`,
    )
    .join("\n");

  // Enhanced prompt for 1200+ words
  const prompt = `
You are a senior SEO content writer and Elon Musk expert writing for an authoritative knowledge base.

PAGE TITLE: ${page.page}
TOPIC HUB: ${page.topic}
CURRENT DATE: ${new Date().toISOString().split("T")[0]}

DYNAMIC VARIABLES:
- Elon's age: ${vars.age}
- Children count: ${vars.children_count}
- Net worth: ${vars.net_worth}
- Date of birth: ${vars.dob}

TOP SEARCH QUERIES (integrate these naturally):
${keywordLines}

REFERENCE CONTEXT (use this to inform your writing):
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
- Cite timeframes for all time-sensitive information (e.g., "[As of 2025]", "As of January 2025")
- Cite sources for factual claims when possible (e.g., "According to...", "Reported by...")
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

Write ONLY the markdown content (no meta-commentary). Begin now:
`.trim();

  let contentMd = "";
  const modelName =
    process.env.VECTORENGINE_CONTENT_MODEL ?? "claude-sonnet-4-5-20250929";
  let wordCount = 0;

  // Generate with retry logic for word count
  const genResult = await generateWithRetry({
    prompt,
    model: modelName,
    minWords: MIN_WORDS_CLUSTER,
    initialMaxTokens: 3000,
    retryMaxTokens: 4000,
    slug,
    kind: "cluster",
  });

  contentMd = genResult.contentMd;
  wordCount = genResult.wordCount;

  // Cache the result
  await setCachedContent({
    kind: "cluster_page",
    slug,
    model: modelName,
    contentMd,
    ttlSeconds: params.ttlSeconds ?? 60 * 60 * 24 * 30, // 30 days
    sources: {
      kind: "cluster_page",
      slug,
      generatedAt: new Date().toISOString(),
      ragContexts: ragResult.contexts.length,
      wordCount,
    },
  });

  return {
    contentMd,
    model: modelName,
    wordCount,
    ragContextsUsed: ragResult.contexts.length,
  };
}

/**
 * Generate PAA answer using RAG + VectorEngine
 */
export async function generatePaaAnswerEnhanced(params: {
  slug: string;
  ttlSeconds?: number;
}): Promise<{
  contentMd: string;
  model: string;
  wordCount: number;
  ragContextsUsed: number;
}> {
  const q = await findPaaQuestion(params.slug);
  if (!q) throw new Error("PAA question not found");

  const vars = await getDynamicVariables();

  // Build RAG context
  const ragResult = await buildRagContext({
    query: q.question,
    includePaa: true,
    includeContentCache: true,
    includeClusters: true,
  });

  const ragContextFormatted = formatRagContexts(ragResult.contexts);

  const prompt = `
You are a research writer specializing in Elon Musk and his ventures.

QUESTION: ${q.question}
${q.answer ? `EXISTING SNIPPET: ${q.answer}` : ""}
${q.sourceUrl ? `SOURCE: ${q.sourceUrl}` : ""}
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
- Always include timeframes for time-sensitive info (e.g., "[As of 2025]", "As of January 2025")
- Cite specific dates, numbers, and sources when possible
- Avoid speculation unless clearly marked as such
- Write in clear, accessible language
- Target 800-1000 words total

Write ONLY the markdown content. Begin:
`.trim();

  let contentMd = "";
  const modelName =
    process.env.VECTORENGINE_CONTENT_MODEL ?? "claude-sonnet-4-5-20250929";
  let wordCount = 0;

  // Generate with retry logic for word count
  const genResult = await generateWithRetry({
    prompt,
    model: modelName,
    minWords: MIN_WORDS_PAA,
    initialMaxTokens: 2000,
    retryMaxTokens: 3000,
    slug: params.slug,
    kind: "paa",
  });

  contentMd = genResult.contentMd;
  wordCount = genResult.wordCount;

  // Cache the result
  await setCachedContent({
    kind: "paa_question",
    slug: params.slug,
    model: modelName,
    contentMd,
    ttlSeconds: params.ttlSeconds ?? 60 * 60 * 24 * 30,
    sources: {
      kind: "paa_question",
      slug: params.slug,
      generatedAt: new Date().toISOString(),
      ragContexts: ragResult.contexts.length,
      wordCount,
    },
  });

  return {
    contentMd,
    model: modelName,
    wordCount,
    ragContextsUsed: ragResult.contexts.length,
  };
}
