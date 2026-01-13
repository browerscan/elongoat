// server-only: Proxy-Grid API client for SERP and web scraping
import { getProxyGridConfig } from "./env";
import {
  get,
  buildKey,
  type CacheOptions,
  invalidatePattern,
  getStats as getCacheStats,
} from "./tieredCache";
import { getCircuitBreaker } from "./circuitBreaker";
import { withRetry } from "./retry";

// ============================================================================
// Types
// ============================================================================

export type ProxyGridSearchType =
  | "google"
  | "bing"
  | "youtube"
  | "youtube_info"
  | "youtube_serp"
  | "similarweb"
  | "web2md"
  | "screenshot"
  | "hackernews"
  | "reddit"
  | "twitter"
  | "instagram"
  | "tiktok"
  | "amazon"
  | "crunchbase";

export interface GoogleSerpResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  displayed_link?: string;
  date?: string;
}

export interface PaaQuestion {
  question: string;
  snippet?: string;
  link?: string;
  position: number;
}

export interface GoogleSerpResponse {
  results: GoogleSerpResult[];
  peopleAlsoAsk?: PaaQuestion[];
  relatedSearches?: string[];
  totalResults?: string;
  searchTime?: number;
}

export interface YouTubeTranscriptResponse {
  videoId: string;
  title: string;
  transcript: Array<{
    text: string;
    offset: number;
    duration: number;
  }>;
  fullText: string;
}

export interface YouTubeInfoResponse {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  likeCount?: number;
  duration: string;
  thumbnail: string;
}

export interface Web2MdResponse {
  url: string;
  markdown: string;
  title?: string;
  author?: string;
  publishedAt?: string;
}

export interface SimilarWebResponse {
  domain: string;
  rank: number;
  category: string;
  visits: string;
  avgVisitDuration: string;
  pagesPerVisit: number;
  bounceRate: number;
  topCountries: Array<{ country: string; percent: number }>;
}

export interface ProxyGridError {
  error: string;
  message?: string;
}

// Retryable error patterns for Proxy-Grid
function isRetryableProxyGridError(error: unknown): boolean {
  if (error instanceof Error) {
    const patterns = [
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ECONNREFUSED/i,
      /timeout/i,
      /fetch failed/i,
      /network/i,
      /502/,
      /503/,
      /504/,
      /Proxy-Grid API timeout/i,
    ];
    return patterns.some((pattern) => pattern.test(error.message));
  }
  return false;
}

// ============================================================================
// API Client with Circuit Breaker, Retry, and Tiered Cache
// ============================================================================

const config = getProxyGridConfig();

// Circuit breaker for Proxy-Grid API
const proxyGridCircuitBreaker = getCircuitBreaker("proxy-grid", {
  threshold: 5,
  timeout: config.timeout,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

async function fetchProxyGrid<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  options: {
    force?: boolean;
    timeout?: number;
    useCache?: boolean;
    l2Ttl?: number;
  } = {},
): Promise<T> {
  const {
    force = false,
    timeout = config.timeout,
    useCache = true,
    l2Ttl = config.cacheTtl,
  } = options;

  // Build cache key from endpoint and body
  const bodyKey =
    Object.keys(body).length === 0 ? "" : ":" + JSON.stringify(body);
  const cacheKey = buildKey(["pg", endpoint, bodyKey], "serp");

  // Fetch function with circuit breaker protection
  const fetchData = () =>
    proxyGridCircuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${config.baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiSecret && { "x-grid-secret": config.apiSecret }),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Proxy-Grid API error: ${response.status} ${response.statusText}`,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Proxy-Grid API timeout after ${timeout}ms`);
        }
        throw error;
      }
    });

  // Use tiered cache with retry on cache miss
  const cacheOptions: CacheOptions = {
    forceRefresh: force,
    l2Ttl,
  };

  return withRetry(
    async () => {
      if (!useCache || force) {
        return fetchData();
      }

      const result = await get(cacheKey, fetchData, cacheOptions);
      return result.data;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      retryableErrors: isRetryableProxyGridError,
    },
  );
}

// ============================================================================
// Google SERP
// ============================================================================

export interface SerpOptions {
  force?: boolean;
  timeout?: number;
  useCache?: boolean;
}

/**
 * Perform a Google SERP search
 */
export async function googleSerp(
  query: string,
  options: SerpOptions = {},
): Promise<GoogleSerpResponse> {
  return fetchProxyGrid<GoogleSerpResponse>(
    "/api/search",
    { type: "google", query },
    options,
  );
}

/**
 * Perform a Bing SERP search
 */
export async function bingSerp(
  query: string,
  options: SerpOptions = {},
): Promise<GoogleSerpResponse> {
  return fetchProxyGrid<GoogleSerpResponse>(
    "/api/search",
    { type: "bing", query },
    options,
  );
}

/**
 * Get only PAA (People Also Ask) questions from Google SERP
 */
export async function getPeopleAlsoAsk(
  query: string,
  options: SerpOptions = {},
): Promise<PaaQuestion[]> {
  const result = await googleSerp(query, options);
  return result.peopleAlsoAsk || [];
}

/**
 * Get related searches from Google SERP
 */
export async function getRelatedSearches(
  query: string,
  options: SerpOptions = {},
): Promise<string[]> {
  const result = await googleSerp(query, options);
  return result.relatedSearches || [];
}

// ============================================================================
// YouTube
// ============================================================================

/**
 * Get YouTube video transcript
 */
export async function youtubeTranscript(
  videoIdOrUrl: string,
  options: SerpOptions = {},
): Promise<YouTubeTranscriptResponse> {
  return fetchProxyGrid<YouTubeTranscriptResponse>(
    "/api/search",
    { type: "youtube", query: videoIdOrUrl },
    options,
  );
}

/**
 * Get YouTube video info
 */
export async function youtubeInfo(
  videoIdOrUrl: string,
  options: SerpOptions = {},
): Promise<YouTubeInfoResponse> {
  return fetchProxyGrid<YouTubeInfoResponse>(
    "/api/search",
    { type: "youtube_info", query: videoIdOrUrl },
    options,
  );
}

/**
 * Search YouTube videos
 */
export async function youtubeSerp(
  query: string,
  options: SerpOptions = {},
): Promise<GoogleSerpResponse> {
  return fetchProxyGrid<GoogleSerpResponse>(
    "/api/search",
    { type: "youtube_serp", query },
    options,
  );
}

// ============================================================================
// Web Content
// ============================================================================

/**
 * Convert web page to markdown
 */
export async function web2md(
  url: string,
  options: SerpOptions = {},
): Promise<Web2MdResponse> {
  return fetchProxyGrid<Web2MdResponse>(
    "/api/search",
    { type: "web2md", url },
    options,
  );
}

/**
 * Take screenshot of a web page
 */
export async function screenshot(
  url: string,
  options: SerpOptions = {},
): Promise<{ screenshot: string; url: string }> {
  return fetchProxyGrid<{ screenshot: string; url: string }>(
    "/api/search",
    { type: "screenshot", url },
    options,
  );
}

// ============================================================================
// Social Media
// ============================================================================

/**
 * Get Reddit post data
 */
export async function redditPost(
  postUrl: string,
  options: SerpOptions = {},
): Promise<{
  title: string;
  content: string;
  comments: number;
  upvotes: number;
}> {
  return fetchProxyGrid(
    "/api/search",
    { type: "reddit", query: postUrl },
    options,
  );
}

/**
 * Get Twitter/X tweet data
 */
export async function twitterTweet(
  tweetUrl: string,
  options: SerpOptions = {},
): Promise<{ text: string; author: string; likes: number; retweets: number }> {
  return fetchProxyGrid(
    "/api/search",
    { type: "twitter", query: tweetUrl },
    options,
  );
}

/**
 * Get Instagram profile data
 */
export async function instagramProfile(
  username: string,
  options: SerpOptions = {},
): Promise<{ bio: string; followers: number; posts: number }> {
  return fetchProxyGrid(
    "/api/search",
    { type: "instagram", query: username },
    options,
  );
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get SimilarWeb domain data
 */
export async function similarWeb(
  domain: string,
  options: SerpOptions = {},
): Promise<SimilarWebResponse> {
  return fetchProxyGrid<SimilarWebResponse>(
    "/api/search",
    { type: "similarweb", query: domain },
    options,
  );
}

/**
 * Get Hacker News stories
 */
export async function hackerNews(
  type: "top" | "new" | "best" | string,
  options: SerpOptions = {},
): Promise<Array<{ title: string; url: string; points: number; id: number }>> {
  return fetchProxyGrid(
    "/api/search",
    { type: "hackernews", query: type },
    options,
  );
}

// ============================================================================
// SERP Analysis for Content Optimization
// ============================================================================

export interface SerpAnalysis {
  query: string;
  topResults: Array<{
    title: string;
    url: string;
    snippet: string;
    wordCount?: number;
    headings?: string[];
  }>;
  peopleAlsoAsk: PaaQuestion[];
  relatedSearches: string[];
  contentGaps: string[];
  suggestedHeadings: string[];
}

/**
 * Comprehensive SERP analysis for content optimization
 */
export async function analyzeSerp(
  query: string,
  options: SerpOptions = {},
): Promise<SerpAnalysis> {
  const [serpResult, paaQuestions, relatedSearches] = await Promise.allSettled([
    googleSerp(query, options),
    getPeopleAlsoAsk(query, options),
    getRelatedSearches(query, options),
  ]);

  const results =
    serpResult.status === "fulfilled" ? serpResult.value.results : [];
  const paa = paaQuestions.status === "fulfilled" ? paaQuestions.value : [];
  const related =
    relatedSearches.status === "fulfilled" ? relatedSearches.value : [];

  // Analyze top results for content patterns
  const topResults = await Promise.all(
    results.slice(0, 5).map(async (result) => {
      // Extract common headings from titles/snippets
      const headings = extractHeadings(result.title, result.snippet);
      return {
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        headings,
      };
    }),
  );

  // Identify content gaps
  const contentGaps = identifyContentGaps(paa);

  // Suggest headings based on PAA and related searches
  const suggestedHeadings = generateHeadingSuggestions(paa, related);

  return {
    query,
    topResults,
    peopleAlsoAsk: paa,
    relatedSearches: related,
    contentGaps,
    suggestedHeadings,
  };
}

function extractHeadings(title: string, snippet: string): string[] {
  const headings: string[] = [];

  // Extract from title
  const titleParts = title.split(/[-|–]/).map((s) => s.trim());
  headings.push(...titleParts.filter((h) => h.length > 3 && h.length < 60));

  // Look for question patterns in snippet
  const questionPattern =
    /[Hh]ow\s+(?:to|do|can|does|is|are)|[Ww]hat\s+(?:is|are|does)|[Ww]hy\s+(?:is|are)|[Ww]hen\s+(?:to|is|are)/g;
  const questions = snippet.match(questionPattern);
  if (questions) {
    headings.push(...questions);
  }

  return [...new Set(headings)].slice(0, 5);
}

function identifyContentGaps(paa: PaaQuestion[]): string[] {
  const gaps: string[] = [];

  // PAA questions that aren't fully answered in typical content
  const gapKeywords = [
    "vs",
    "compare",
    "difference",
    "alternative",
    "better",
    "pros and cons",
    "review",
    "tutorial",
    "step by step",
  ];

  for (const question of paa) {
    const questionLower = question.question.toLowerCase();
    if (gapKeywords.some((keyword) => questionLower.includes(keyword))) {
      gaps.push(question.question);
    }
  }

  return gaps.slice(0, 5);
}

function generateHeadingSuggestions(
  paa: PaaQuestion[],
  related: string[],
): string[] {
  const headings: string[] = [];

  // Convert PAA questions to headings
  for (const question of paa.slice(0, 5)) {
    // Remove question words for h2 headings
    const heading = question.question
      .replace(
        /^(What|How|Why|When|Where|Who|Which|Are|Is|Can|Do|Does)\s+(to\s+)?/i,
        "",
      )
      .replace(/^\w/, (c) => c.toUpperCase());
    headings.push(heading);
  }

  // Add related searches as variations
  for (const search of related.slice(0, 3)) {
    headings.push(search.replace(/"/g, ""));
  }

  return [...new Set(headings)].slice(0, 8);
}

// ============================================================================
// RAG Integration
// ============================================================================

export interface SerpRagContext {
  source: "serp";
  weight: number;
  query: string;
  topResults: GoogleSerpResult[];
  peopleAlsoAsk: PaaQuestion[];
  relatedSearches: string[];
}

/**
 * Build RAG context from SERP data for content generation
 */
export async function buildSerpRagContext(
  query: string,
  options: SerpOptions = {},
): Promise<SerpRagContext | null> {
  try {
    const [serpResult, paaQuestions, relatedSearches] =
      await Promise.allSettled([
        googleSerp(query, options),
        getPeopleAlsoAsk(query, options),
        getRelatedSearches(query, options),
      ]);

    if (
      serpResult.status === "rejected" &&
      paaQuestions.status === "rejected" &&
      relatedSearches.status === "rejected"
    ) {
      return null;
    }

    return {
      source: "serp",
      weight: 0.7, // Between PAA and content cache
      query,
      topResults:
        serpResult.status === "fulfilled" ? serpResult.value.results : [],
      peopleAlsoAsk:
        paaQuestions.status === "fulfilled" ? paaQuestions.value : [],
      relatedSearches:
        relatedSearches.status === "fulfilled" ? relatedSearches.value : [],
    };
  } catch {
    return null;
  }
}

/**
 * Format SERP RAG context for content generation prompt
 */
export function formatSerpRagContext(context: SerpRagContext): string {
  const sections: string[] = [];

  if (context.peopleAlsoAsk.length > 0) {
    sections.push("### People Also Ask (Google SERP):");
    for (const paa of context.peopleAlsoAsk.slice(0, 5)) {
      sections.push(`- **Q:** ${paa.question}`);
      if (paa.snippet) {
        sections.push(`  **A:** ${paa.snippet.slice(0, 200)}...`);
      }
    }
  }

  if (context.relatedSearches.length > 0) {
    sections.push("\n### Related Searches:");
    for (const search of context.relatedSearches.slice(0, 8)) {
      sections.push(`- ${search}`);
    }
  }

  if (context.topResults.length > 0) {
    sections.push("\n### Top Ranking Content:");
    for (const result of context.topResults.slice(0, 3)) {
      sections.push(`- **${result.title}**`);
      sections.push(`  ${result.snippet.slice(0, 150)}...`);
    }
  }

  return sections.join("\n");
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear Proxy-Grid cache entries matching a pattern
 * @param pattern - Optional pattern to match (uses tiered cache pattern matching)
 */
export async function clearProxyGridCache(pattern?: string): Promise<number> {
  if (!pattern) {
    // Clear all serp-prefixed keys from L1
    return invalidatePattern("serp:*");
  }
  return invalidatePattern(`serp:*${pattern}*`);
}

/**
 * Get Proxy-Grid cache statistics
 */
export function getProxyGridCacheStats(): {
  size: number;
  keys: string[];
  hitRate: number;
  l1Hits: number;
  l2Hits: number;
} {
  const stats = getCacheStats();
  return {
    size: stats.l1Size,
    keys: [], // L1 keys not exposed for memory efficiency
    hitRate: stats.hitRate,
    l1Hits: stats.l1Hits,
    l2Hits: stats.l2Hits,
  };
}
