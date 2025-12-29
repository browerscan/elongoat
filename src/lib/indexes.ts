import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const TopicSchema = z.object({
  slug: z.string().min(1),
  topic: z.string().min(1),
  pageCount: z.number().int().nonnegative(),
  totalVolume: z.number().int().nonnegative(),
  pages: z.array(z.string().min(1)),
});
export type ClusterTopic = z.infer<typeof TopicSchema>;

const KeywordSchema = z.object({
  keyword: z.string().min(1),
  volume: z.number().int().nonnegative(),
  kd: z.number().int().nonnegative(),
  intent: z.string().optional().default(""),
  cpc: z.string().optional().default(""),
  serp_features: z.string().optional().default(""),
});
export type ClusterKeyword = z.infer<typeof KeywordSchema>;

const PageSchema = z.object({
  slug: z.string().min(1), // `${topicSlug}/${pageSlug}`
  topicSlug: z.string().min(1),
  topic: z.string().min(1),
  pageSlug: z.string().min(1),
  page: z.string().min(1),
  pageType: z.string().nullable().optional(),
  seedKeyword: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  keywordCount: z.number().int().nonnegative(),
  maxVolume: z.number().int().nonnegative(),
  totalVolume: z.number().int().nonnegative(),
  minKd: z.number().int().nullable().optional(),
  maxKd: z.number().int().nullable().optional(),
  topKeywords: z.array(KeywordSchema),
});
export type ClusterPage = z.infer<typeof PageSchema>;

const ClusterIndexSchema = z.object({
  generatedAt: z.string().min(1),
  source: z.string().min(1),
  topics: z.array(TopicSchema),
  pages: z.array(PageSchema),
});
export type ClusterIndex = z.infer<typeof ClusterIndexSchema>;

const PaaQuestionSchema = z.object({
  slug: z.string().min(1),
  question: z.string().min(1),
  parent: z.string().nullable().optional(),
  answer: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  volume: z.number().int().nonnegative(),
});
export type PaaQuestion = z.infer<typeof PaaQuestionSchema>;

const PaaIndexSchema = z.object({
  generatedAt: z.string().min(1),
  source: z.string().min(1),
  questions: z.array(PaaQuestionSchema),
});
export type PaaIndex = z.infer<typeof PaaIndexSchema>;

const TopListSchema = z.object({
  generatedAt: z.string().min(1),
  source: z.string().min(1),
  count: z.number().int().nonnegative(),
  slugs: z.array(z.string().min(1)),
});

function projectPath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}

let clusterIndexCache: ClusterIndex | null = null;
let paaIndexCache: PaaIndex | null = null;
let topPagesCache: string[] | null = null;
let topQuestionsCache: string[] | null = null;

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
}

export async function getClusterIndex(): Promise<ClusterIndex> {
  if (clusterIndexCache) return clusterIndexCache;
  const data = await readJsonFile(
    projectPath("data", "generated", "cluster-index.json"),
  );
  clusterIndexCache = ClusterIndexSchema.parse(data);
  return clusterIndexCache;
}

export async function getPaaIndex(): Promise<PaaIndex> {
  if (paaIndexCache) return paaIndexCache;
  const data = await readJsonFile(
    projectPath("data", "generated", "paa-index.json"),
  );
  paaIndexCache = PaaIndexSchema.parse(data);
  return paaIndexCache;
}

export async function getTopPageSlugs(): Promise<string[]> {
  if (topPagesCache) return topPagesCache;
  const data = await readJsonFile(
    projectPath("data", "generated", "top-pages.json"),
  );
  topPagesCache = TopListSchema.parse(data).slugs;
  return topPagesCache;
}

export async function getTopQuestionSlugs(): Promise<string[]> {
  if (topQuestionsCache) return topQuestionsCache;
  const data = await readJsonFile(
    projectPath("data", "generated", "top-questions.json"),
  );
  topQuestionsCache = TopListSchema.parse(data).slugs;
  return topQuestionsCache;
}

export async function findTopic(
  topicSlug: string,
): Promise<ClusterTopic | null> {
  const index = await getClusterIndex();
  return index.topics.find((t) => t.slug === topicSlug) ?? null;
}

export async function listTopicPages(
  topicSlug: string,
): Promise<ClusterPage[]> {
  const index = await getClusterIndex();
  return index.pages
    .filter((p) => p.topicSlug === topicSlug)
    .sort((a, b) => b.maxVolume - a.maxVolume);
}

export async function findPage(
  topicSlug: string,
  pageSlug: string,
): Promise<ClusterPage | null> {
  const index = await getClusterIndex();
  const fullSlug = `${topicSlug}/${pageSlug}`;
  return index.pages.find((p) => p.slug === fullSlug) ?? null;
}

export async function findPaaQuestion(
  slug: string,
): Promise<PaaQuestion | null> {
  const index = await getPaaIndex();
  return index.questions.find((q) => q.slug === slug) ?? null;
}
