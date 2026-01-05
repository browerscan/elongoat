import { findPage, findPaaQuestion } from "./indexes";
import { getCachedContent, setCachedContent } from "./contentCache";
import { getDynamicVariables } from "./variables";
import { vectorEngineChatComplete } from "./vectorengine";
import { getEnv } from "./env";

const env = getEnv();

function getContentModel(): string | null {
  if (!env.VECTORENGINE_API_KEY) return null;
  return env.VECTORENGINE_CONTENT_MODEL;
}

export async function getClusterPageContent(params: {
  topicSlug: string;
  pageSlug: string;
}): Promise<{ contentMd: string; model: string; cached: boolean }> {
  const slug = `${params.topicSlug}/${params.pageSlug}`;
  const cached = await getCachedContent({ kind: "cluster_page", slug });
  if (cached)
    return {
      contentMd: cached.contentMd,
      model: cached.model ?? "cache",
      cached: true,
    };

  const page = await findPage(params.topicSlug, params.pageSlug);
  if (!page) {
    return {
      contentMd: `## Not found\nThis cluster page doesn't exist in the current dataset.`,
      model: "static-template",
      cached: false,
    };
  }

  const vars = await getDynamicVariables();
  const contentMd = staticClusterMarkdown(
    page.page,
    page.topic,
    vars.age,
    page.topKeywords,
  );

  return { contentMd, model: "static-template", cached: false };
}

export async function generateClusterPageContent(params: {
  topicSlug: string;
  pageSlug: string;
  ttlSeconds?: number;
}): Promise<{ contentMd: string; model: string }> {
  const slug = `${params.topicSlug}/${params.pageSlug}`;
  const page = await findPage(params.topicSlug, params.pageSlug);
  if (!page) throw new Error("Cluster page not found");

  const vars = await getDynamicVariables();

  const model = getContentModel();
  if (!model) throw new Error("VectorEngine content model not configured");

  const keywordLines = page.topKeywords
    .slice(0, 12)
    .map(
      (k) =>
        `- ${k.keyword} (vol ${k.volume}, kd ${k.kd}${k.intent ? `, intent ${k.intent}` : ""})`,
    )
    .join("\n");

  const system = [
    `You are a senior SEO editor + technical writer with expertise in Elon Musk and his ventures.`,
    `Goal: write a high-quality, fact-safe, non-clickbait Markdown brief for a page in an "Elon Musk knowledge base" site.`,
    `Important: You are NOT writing as Elon. You are an objective analyst.`,
    `Never invent private details or claim insider access. Only use public information.`,
    `If you are unsure, explicitly say so and suggest how to verify.`,
    `Always cite approximate timeframes for facts (e.g., "as of 2025", "in 2021").`,
    `Include current date context: ${new Date().toISOString().split("T")[0]}.`,
    `Output: Markdown only.`,
  ].join("\n");

  const user = [
    `PAGE TITLE: ${page.page}`,
    `TOPIC HUB: ${page.topic}`,
    `SITE CONTEXT: This site has a chat simulation called "ElonSim" (not the real Elon).`,
    `VARIABLES: age=${vars.age}, children_count=${vars.children_count}, net_worth="${vars.net_worth}", dob=${vars.dob}`,
    ``,
    `TOP QUERIES (from keyword data):`,
    keywordLines || "- (none)",
    ``,
    `Write a comprehensive page with the following structure:`,
    `1) ## TL;DR (2–4 bullets summarizing key points)`,
    `2) ## What people usually mean by "${page.page}" (context)`,
    `3) ## Key angles / sub-questions (5–8 bullets covering different aspects)`,
    `4) ## Practical answer framework (step-by-step explanation)`,
    `5) ## FAQ (5 questions + short answers)`,
    `6) ## Sources & verification (list reputable sources to check)`,
    `7) ## Freshness note (mention when this information might become outdated)`,
    ``,
    `Tone: crisp, high signal, mildly techy, SEO-optimized.`,
    `Include relevant keywords naturally from the queries list.`,
    `Add timestamps/timeframes for any time-sensitive information.`,
  ].join("\n");

  const completion = await vectorEngineChatComplete({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.35,
    maxTokens: 1000,
  });

  const contentMd =
    completion.text.trim() ||
    staticClusterMarkdown(page.page, page.topic, vars.age, page.topKeywords);
  await setCachedContent({
    kind: "cluster_page",
    slug,
    model,
    contentMd,
    ttlSeconds: params.ttlSeconds ?? 60 * 60 * 24 * 7,
    sources: {
      kind: "cluster_page",
      slug,
      generatedAt: new Date().toISOString(),
    },
  });
  return { contentMd, model };
}

export async function getPaaAnswerContent(params: { slug: string }): Promise<{
  contentMd: string;
  model: string;
  cached: boolean;
}> {
  const cached = await getCachedContent({
    kind: "paa_question",
    slug: params.slug,
  });
  if (cached)
    return {
      contentMd: cached.contentMd,
      model: cached.model ?? "cache",
      cached: true,
    };

  const q = await findPaaQuestion(params.slug);
  if (!q) {
    return {
      contentMd: `## Not found\nThis question doesn't exist in the current dataset.`,
      model: "static-template",
      cached: false,
    };
  }

  const contentMd = staticPaaMarkdown(q.question, q.answer ?? null);
  return { contentMd, model: "static-template", cached: false };
}

export async function generatePaaAnswer(params: {
  slug: string;
  ttlSeconds?: number;
}): Promise<{
  contentMd: string;
  model: string;
}> {
  const q = await findPaaQuestion(params.slug);
  if (!q) throw new Error("PAA question not found");

  const vars = await getDynamicVariables();

  const model = getContentModel();
  if (!model) throw new Error("VectorEngine content model not configured");

  const system = [
    `You are a senior research writer specializing in Elon Musk and his companies.`,
    `You must be factual and cautious; do not invent private information.`,
    `You are NOT Elon Musk. You are an objective analyst.`,
    `Always include timeframes for facts (e.g., "as of late 2025", "in 2021").`,
    `Current date: ${new Date().toISOString().split("T")[0]}.`,
    `Output: Markdown only.`,
  ].join("\n");

  const user = [
    `QUESTION: ${q.question}`,
    q.answer
      ? `EXISTING SNIPPET (may be outdated): ${q.answer}`
      : `EXISTING SNIPPET: (none)`,
    q.sourceUrl ? `SOURCE URL (may be partial): ${q.sourceUrl}` : "",
    ``,
    `VARIABLES: age=${vars.age}, children_count=${vars.children_count}, net_worth="${vars.net_worth}", dob=${vars.dob}`,
    ``,
    `Write a comprehensive answer with the following structure:`,
    `1) ## Short answer (3–6 sentences with timeframe)`,
    `2) ## Detailed explanation (2–4 short paragraphs with context)`,
    `3) ## What to verify / common misconceptions (bullets)`,
    `4) ## Freshness indicator (when this info might change)`,
    `5) ## Sources to check (specific, reputable sources)`,
    ``,
    `Avoid sensationalism. If topic is uncertain or controversial, emphasize verification.`,
    `For financial info, always note volatility and suggest checking real-time sources.`,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await vectorEngineChatComplete({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.35,
    maxTokens: 1000,
  });

  const contentMd =
    completion.text.trim() || staticPaaMarkdown(q.question, q.answer ?? null);
  await setCachedContent({
    kind: "paa_question",
    slug: q.slug,
    model,
    contentMd,
    ttlSeconds: params.ttlSeconds ?? 60 * 60 * 24 * 7,
    sources: {
      kind: "paa_question",
      slug: q.slug,
      generatedAt: new Date().toISOString(),
    },
  });
  return { contentMd, model };
}

function staticClusterMarkdown(
  title: string,
  topic: string,
  age: number,
  topKeywords: {
    keyword: string;
    volume: number;
    kd: number;
    intent?: string;
  }[],
) {
  const currentDate = new Date().toISOString().split("T")[0];
  const kw = topKeywords
    .slice(0, 12)
    .map(
      (k) =>
        `- ${k.keyword} (vol ${k.volume}, kd ${k.kd}${k.intent ? `, intent ${k.intent}` : ""})`,
    )
    .join("\n");

  return [
    `## TL;DR`,
    `- This page is part of the **${topic}** hub.`,
    `- Use the chat (bottom-right) to get a tailored answer; this site is an AI simulation, not Elon Musk.`,
    `- Information current as of ${currentDate}.`,
    ``,
    `## What people usually mean`,
    `Searchers using "${title}" are typically looking for quick context + the latest credible sources.`,
    ``,
    `## Top queries`,
    kw || "- (none)",
    ``,
    `## Notes`,
    `- Variables: Elon age is currently **${age}** (auto-calculated).`,
    `- Live finance/news can change quickly — verify with primary sources.`,
    ``,
    `## Freshness indicators`,
    `- **Financial data**: Check real-time sources (stock prices, funding rounds)`,
    `- **Company news**: Verify recent announcements from official channels`,
    `- **Biographical info**: Relatively stable but check for recent updates`,
  ].join("\n");
}

function staticPaaMarkdown(question: string, snippet: string | null) {
  const currentDate = new Date().toISOString().split("T")[0];

  return [
    `## Short answer`,
    snippet
      ? `A captured snippet says: ${snippet}`
      : `No snippet was captured for this question. Use chat for a generated answer.`,
    ``,
    `## What to verify`,
    `- Dates/timeframes (information may have changed since ${currentDate})`,
    `- Primary sources (SEC filings, official press releases, reputable outlets)`,
    `- Recent news articles for the most up-to-date information`,
    ``,
    `## Freshness indicator`,
    `- Financial information: changes daily, check real-time sources`,
    `- Family/biographical info: relatively stable but verify recent updates`,
    `- Company news: can change rapidly, check official announcements`,
    ``,
    `## Sources`,
    `- Try searching reputable sources and cross-check claims.`,
    `- Official company accounts: @SpaceX, @Tesla, @x.ai`,
    ``,
    `> Note: This site includes an AI simulation ("ElonSim"), not the real person.`,
  ].join("\n");
}
