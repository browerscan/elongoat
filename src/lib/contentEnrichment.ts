// Content enrichment module using Proxy-Grid APIs
// Integrates external content sources for RAG-enhanced content generation

import {
  web2md,
  youtubeTranscript,
  youtubeInfo,
  googleSerp,
} from "./proxyGrid";
import { buildKey, get } from "./tieredCache";
import { getEnv } from "./env";

const env = getEnv();

// ============================================================================
// Configuration
// ============================================================================

const ENRICHMENT_CACHE_TTL_MS = env.PROXY_GRID_CACHE_TTL_MS; // 4 hours default
const ENRICHMENT_TIMEOUT_MS = 15000; // 15 seconds per enrichment

// ============================================================================
// Types
// ============================================================================

export type EnrichmentSource = "web" | "youtube" | "serp" | "youtube_info";

export interface EnrichedWebContent {
  source: "web";
  url: string;
  markdown: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  wordCount: number;
  fetchedAt: string;
}

export interface EnrichedYouTubeContent {
  source: "youtube";
  videoId: string;
  title: string;
  description: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  transcript?: {
    fullText: string;
    segments: Array<{ text: string; offset: number; duration: number }>;
    wordCount: number;
  };
  fetchedAt: string;
}

export interface EnrichedSerpInsights {
  source: "serp";
  query: string;
  topResults: Array<{
    title: string;
    url: string;
    snippet: string;
    position: number;
  }>;
  peopleAlsoAsk: Array<{
    question: string;
    snippet?: string;
    link?: string;
  }>;
  relatedSearches: string[];
  fetchedAt: string;
}

export type EnrichedContent =
  | EnrichedWebContent
  | EnrichedYouTubeContent
  | EnrichedSerpInsights;

export interface ContentEnrichmentOptions {
  timeout?: number;
  useCache?: boolean;
  maxTranscriptLength?: number;
  includeFullTranscript?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractVideoId(input: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function buildEnrichmentCacheKey(
  source: EnrichmentSource,
  identifier: string,
): string {
  return buildKey(["enrichment", source, identifier], "ce");
}

// ============================================================================
// Web Content Enrichment
// ============================================================================

/**
 * Enrich content by fetching and converting a web page to markdown
 * Uses tiered caching (L1: memory, L2: Redis) with Proxy-Grid as the source
 */
export async function enrichFromWeb(
  url: string,
  options: ContentEnrichmentOptions = {},
): Promise<EnrichedWebContent | null> {
  const cacheKey = buildEnrichmentCacheKey("web", url);
  const timeout = options.timeout ?? ENRICHMENT_TIMEOUT_MS;
  const useCache = options.useCache !== false;

  const fetchFn = async (): Promise<EnrichedWebContent> => {
    const result = await web2md(url, { timeout });

    if (!result || !result.markdown) {
      throw new Error(`Failed to fetch content from ${url}`);
    }

    return {
      source: "web",
      url,
      markdown: result.markdown,
      title: result.title,
      author: result.author,
      publishedAt: result.publishedAt,
      wordCount: countWords(result.markdown),
      fetchedAt: new Date().toISOString(),
    };
  };

  try {
    if (useCache) {
      const cacheResult = await get(cacheKey, fetchFn, {
        l2Ttl: ENRICHMENT_CACHE_TTL_MS,
      });
      return cacheResult.data as EnrichedWebContent;
    }
    return await fetchFn();
  } catch (error) {
    console.error("[ContentEnrichment] Web enrichment failed:", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Batch enrich multiple web URLs with controlled concurrency
 */
export async function enrichFromWebBatch(
  urls: string[],
  options: ContentEnrichmentOptions & { concurrency?: number } = {},
): Promise<EnrichedWebContent[]> {
  const concurrency = options.concurrency ?? 3;
  const results: EnrichedWebContent[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((url) => enrichFromWeb(url, options)),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

// ============================================================================
// YouTube Content Enrichment
// ============================================================================

/**
 * Enrich content from YouTube video transcript
 * Fetches both video metadata and transcript if available
 */
export async function enrichFromYouTube(
  videoIdOrUrl: string,
  options: ContentEnrichmentOptions = {},
): Promise<EnrichedYouTubeContent | null> {
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) {
    console.error("[ContentEnrichment] Invalid YouTube ID:", videoIdOrUrl);
    return null;
  }

  const cacheKey = buildEnrichmentCacheKey("youtube", videoId);
  const timeout = options.timeout ?? ENRICHMENT_TIMEOUT_MS;
  const useCache = options.useCache !== false;
  const includeFullTranscript = options.includeFullTranscript !== false;
  const maxTranscriptLength = options.maxTranscriptLength ?? 50000;

  const fetchFn = async (): Promise<EnrichedYouTubeContent> => {
    // Fetch both info and transcript in parallel
    const [infoResult, transcriptResult] = await Promise.allSettled([
      youtubeInfo(videoId, { timeout }),
      includeFullTranscript
        ? youtubeTranscript(videoId, { timeout })
        : Promise.resolve(null),
    ]);

    const info = infoResult.status === "fulfilled" ? infoResult.value : null;
    const transcript =
      transcriptResult.status === "fulfilled" ? transcriptResult.value : null;

    if (!info) {
      throw new Error(`Failed to fetch YouTube info for ${videoId}`);
    }

    // Process transcript
    let transcriptData:
      | {
          fullText: string;
          segments: NonNullable<typeof transcript>["transcript"];
          wordCount: number;
        }
      | undefined;

    if (transcript?.transcript) {
      const fullText = transcript.transcript
        .map((t) => t.text)
        .join(" ")
        .trim();

      // Truncate if too long
      const processedText =
        fullText.length > maxTranscriptLength
          ? fullText.slice(0, maxTranscriptLength) + "..."
          : fullText;

      transcriptData = {
        fullText: processedText,
        segments: transcript.transcript,
        wordCount: countWords(processedText),
      };
    }

    return {
      source: "youtube",
      videoId,
      title: info.title,
      description: info.description,
      channel: info.channel,
      channelId: info.channelId,
      publishedAt: info.publishedAt,
      viewCount: info.viewCount,
      transcript: transcriptData,
      fetchedAt: new Date().toISOString(),
    };
  };

  try {
    if (useCache) {
      const cacheResult = await get(cacheKey, fetchFn, {
        l2Ttl: ENRICHMENT_CACHE_TTL_MS,
      });
      return cacheResult.data as EnrichedYouTubeContent;
    }
    return await fetchFn();
  } catch (error) {
    console.error("[ContentEnrichment] YouTube enrichment failed:", {
      videoId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Enrich content from YouTube video info only (no transcript)
 * Faster alternative when full transcript is not needed
 */
export async function enrichFromYouTubeInfo(
  videoIdOrUrl: string,
  options: ContentEnrichmentOptions = {},
): Promise<EnrichedYouTubeContent | null> {
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) {
    return null;
  }

  const cacheKey = buildEnrichmentCacheKey("youtube_info", videoId);
  const timeout = options.timeout ?? ENRICHMENT_TIMEOUT_MS;
  const useCache = options.useCache !== false;

  const fetchFn = async (): Promise<EnrichedYouTubeContent> => {
    const info = await youtubeInfo(videoId, { timeout });

    return {
      source: "youtube",
      videoId,
      title: info.title,
      description: info.description,
      channel: info.channel,
      channelId: info.channelId,
      publishedAt: info.publishedAt,
      viewCount: info.viewCount,
      fetchedAt: new Date().toISOString(),
    };
  };

  try {
    if (useCache) {
      const cacheResult = await get(cacheKey, fetchFn, {
        l2Ttl: ENRICHMENT_CACHE_TTL_MS,
      });
      return cacheResult.data as EnrichedYouTubeContent;
    }
    return await fetchFn();
  } catch (error) {
    console.error("[ContentEnrichment] YouTube info enrichment failed:", {
      videoId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// SERP-Based Enrichment
// ============================================================================

/**
 * Enrich content from Google SERP results
 * Provides search insights, PAA questions, and related searches
 */
export async function enrichFromSerp(
  query: string,
  options: ContentEnrichmentOptions = {},
): Promise<EnrichedSerpInsights | null> {
  const cacheKey = buildEnrichmentCacheKey("serp", query);
  const timeout = options.timeout ?? ENRICHMENT_TIMEOUT_MS;
  const useCache = options.useCache !== false;

  const fetchFn = async (): Promise<EnrichedSerpInsights> => {
    const result = await googleSerp(query, { timeout });

    return {
      source: "serp",
      query,
      topResults: result.results.map((r, i) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        position: i + 1,
      })),
      peopleAlsoAsk:
        result.peopleAlsoAsk?.map((paa) => ({
          question: paa.question,
          snippet: paa.snippet,
          link: paa.link,
        })) ?? [],
      relatedSearches: result.relatedSearches ?? [],
      fetchedAt: new Date().toISOString(),
    };
  };

  try {
    if (useCache) {
      const cacheResult = await get(cacheKey, fetchFn, {
        l2Ttl: ENRICHMENT_CACHE_TTL_MS,
      });
      return cacheResult.data as EnrichedSerpInsights;
    }
    return await fetchFn();
  } catch (error) {
    console.error("[ContentEnrichment] SERP enrichment failed:", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Multi-Source Enrichment
// ============================================================================

export interface EnrichmentRequest {
  webUrls?: string[];
  youtubeIds?: string[];
  serpQueries?: string[];
  options?: ContentEnrichmentOptions;
}

export interface EnrichmentResult {
  webContent: EnrichedWebContent[];
  youtubeContent: EnrichedYouTubeContent[];
  serpInsights: EnrichedSerpInsights[];
  totalCount: number;
  errors: number;
}

/**
 * Enrich content from multiple sources in parallel
 * Returns aggregated results with error tracking
 */
export async function enrichFromMultipleSources(
  request: EnrichmentRequest,
): Promise<EnrichmentResult> {
  const { webUrls = [], youtubeIds = [], serpQueries = [], options } = request;

  const results: EnrichmentResult = {
    webContent: [],
    youtubeContent: [],
    serpInsights: [],
    totalCount: 0,
    errors: 0,
  };

  // Execute all enrichment tasks in parallel
  const tasks: Promise<unknown>[] = [];

  // Web enrichment
  for (const url of webUrls) {
    tasks.push(
      enrichFromWeb(url, options).then((result) => {
        if (result) results.webContent.push(result);
        else results.errors++;
      }),
    );
  }

  // YouTube enrichment
  for (const videoId of youtubeIds) {
    tasks.push(
      enrichFromYouTube(videoId, options).then((result) => {
        if (result) results.youtubeContent.push(result);
        else results.errors++;
      }),
    );
  }

  // SERP enrichment
  for (const query of serpQueries) {
    tasks.push(
      enrichFromSerp(query, options).then((result) => {
        if (result) results.serpInsights.push(result);
        else results.errors++;
      }),
    );
  }

  await Promise.allSettled(tasks);

  results.totalCount =
    results.webContent.length +
    results.youtubeContent.length +
    results.serpInsights.length;

  return results;
}

// ============================================================================
// RAG Integration Helpers
// ============================================================================

/**
 * Convert enriched web content to RAG context
 */
export function webContentToRagContext(content: EnrichedWebContent): {
  source: "web_enrichment";
  weight: number;
  title: string;
  snippet: string;
  url: string;
} {
  return {
    source: "web_enrichment",
    weight: 0.8,
    title: content.title ?? content.url,
    snippet: content.markdown.slice(0, 2000), // Limit for context
    url: content.url,
  };
}

/**
 * Convert enriched YouTube content to RAG context
 */
export function youtubeContentToRagContext(content: EnrichedYouTubeContent): {
  source: "youtube_enrichment";
  weight: number;
  title: string;
  snippet: string;
  videoId: string;
  channel?: string;
} {
  const snippet = content.transcript
    ? content.transcript.fullText.slice(0, 2000)
    : content.description.slice(0, 2000);

  return {
    source: "youtube_enrichment",
    weight: 0.75,
    title: content.title,
    snippet,
    videoId: content.videoId,
    channel: content.channel,
  };
}

/**
 * Convert SERP insights to RAG context
 */
export function serpInsightsToRagContext(content: EnrichedSerpInsights): Array<{
  source: "serp_enrichment";
  weight: number;
  question?: string;
  answer?: string;
  title?: string;
  snippet?: string;
}> {
  const contexts: Array<{
    source: "serp_enrichment";
    weight: number;
    question?: string;
    answer?: string;
    title?: string;
    snippet?: string;
  }> = [];

  // Add PAA questions as contexts
  for (const paa of content.peopleAlsoAsk.slice(0, 5)) {
    contexts.push({
      source: "serp_enrichment",
      weight: 0.7,
      question: paa.question,
      answer: paa.snippet,
    });
  }

  // Add top results as contexts
  for (const result of content.topResults.slice(0, 3)) {
    contexts.push({
      source: "serp_enrichment",
      weight: 0.65,
      title: result.title,
      snippet: result.snippet,
    });
  }

  return contexts;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear enrichment cache for a specific source or all enrichment cache
 */
export async function clearEnrichmentCache(
  source?: EnrichmentSource,
): Promise<number> {
  const { invalidatePattern } = await import("./tieredCache");

  if (source) {
    return invalidatePattern(`ce:*:${source}:*`);
  }
  return invalidatePattern("ce:*");
}

/**
 * Get enrichment cache statistics
 */
export function getEnrichmentCacheStats(): {
  prefix: string;
  description: string;
} {
  return {
    prefix: "ce:",
    description: "Content enrichment cache (web, YouTube, SERP)",
  };
}
