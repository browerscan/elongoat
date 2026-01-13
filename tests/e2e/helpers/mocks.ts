/**
 * Mock Factories for E2E Testing
 *
 * Provides factory functions for creating test data that matches
 * the actual API schemas used in the application.
 */

import { vi } from "vitest";

/**
 * Mock health check response
 */
export function createMockHealthResponse(
  overrides: {
    status?: "healthy" | "degraded" | "unhealthy";
    version?: string;
  } = {},
) {
  return {
    status: overrides.status ?? "healthy",
    timestamp: new Date().toISOString(),
    version: overrides.version ?? "0.1.0",
    components: {
      database: {
        status: "healthy" as const,
        latency: 5,
        details: {
          currentTime: new Date().toISOString(),
          poolTotalCount: 10,
          poolIdleCount: 8,
          poolWaitingCount: 0,
        },
      },
      redis: {
        status: "healthy" as const,
        latency: 2,
        details: {
          version: "7.2.0",
          mode: "standalone",
        },
      },
      vectorEngine: {
        status: "healthy" as const,
        latency: 150,
        details: {
          model: "grok-4-fast-non-reasoning",
          baseUrl: "https://api.vectorengine.ai",
        },
      },
    },
    metrics: {
      memoryUsedMb: 128,
      memoryAvailableMb: 512,
      memoryPercent: 25,
      uptimeSeconds: 3600,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    checks: {
      count: 3,
      passed: 3,
      failed: 0,
      skipped: 0,
    },
  };
}

/**
 * Mock chat request
 */
export function createMockChatRequest(
  overrides: {
    message?: string;
    context?: { currentPage?: string };
  } = {},
) {
  return {
    message: overrides.message ?? "What is SpaceX?",
    context: overrides.context,
  };
}

/**
 * Mock SSE event for chat streaming
 */
export function createMockSSEEvent(type: string, data?: unknown) {
  return {
    id: "event-" + Math.random().toString(36).slice(2, 11),
    event: type,
    data: data ? JSON.stringify(data) : null,
    retry: 1000,
  };
}

/**
 * Mock chat stream delta
 */
export function createMockChatDelta(delta: string) {
  return {
    type: "delta",
    delta,
  };
}

/**
 * Mock chat meta event
 */
export function createMockChatMeta(
  overrides: {
    provider?: string;
    model?: string;
  } = {},
) {
  return {
    type: "meta",
    provider: overrides.provider ?? "vectorengine",
    model: overrides.model ?? "grok-4-fast-non-reasoning",
    conversationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Mock SERP response
 */
export function createMockSerpResponse(
  overrides: {
    query?: string;
    results?: Array<{
      title: string;
      link: string;
      snippet: string;
      position: number;
    }>;
  } = {},
) {
  return {
    query: overrides.query ?? "elon musk",
    results: overrides.results ?? [
      {
        title: "Elon Musk - Wikipedia",
        link: "https://en.wikipedia.org/wiki/Elon_Musk",
        snippet: "Elon Reeve Musk is a business magnate and investor...",
        position: 1,
      },
      {
        title: "Elon Musk (@elonmusk) / X",
        link: "https://x.com/elonmusk",
        snippet: "The latest tweets from Elon Musk (@elonmusk)",
        position: 2,
      },
    ],
    peopleAlsoAsk: [
      {
        question: "How old is Elon Musk?",
        snippet: "Elon Musk was born on June 28, 1971",
        link: "https://example.com/age",
        position: 1,
      },
    ],
    relatedSearches: ["elon musk age", "elon musk net worth", "spacex"],
    cached: false,
  };
}

/**
 * Mock metrics response
 */
export function createMockMetricsResponse() {
  const now = Date.now();
  return `# HELP nodejs_heap_used_bytes Process heap used in bytes
# TYPE nodejs_heap_used_bytes gauge
nodejs_heap_used_bytes ${100 * 1024 * 1024}

# HELP nodejs_heap_total_bytes Process heap total in bytes
# TYPE nodejs_heap_total_bytes gauge
nodejs_heap_total_bytes ${200 * 1024 * 1024}

# HELP db_pool_utilization_percent Database connection pool utilization percentage
# TYPE db_pool_utilization_percent gauge
db_pool_utilization_percent 25.5

# HELP cache_hit_rate Overall cache hit rate (0-1)
# TYPE cache_hit_rate gauge
cache_hit_rate 0.85

# HELP http_request_duration_p95_ms 95th percentile request duration in milliseconds
# TYPE http_request_duration_p95_ms gauge
http_request_duration_p95_ms 125

# HELP metrics_timestamp_ms Timestamp when metrics were collected
# TYPE metrics_timestamp_ms gauge
metrics_timestamp_ms ${now}
`;
}

/**
 * Mock dynamic variables response
 */
export function createMockVariablesResponse(
  overrides: {
    age?: number;
    children_count?: number;
    net_worth?: string;
  } = {},
) {
  return {
    age: overrides.age ?? 54,
    children_count: overrides.children_count ?? 14,
    net_worth: overrides.net_worth ?? "$400B",
    dob: "1971-06-28",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mock cluster page data
 */
export function createMockClusterPage(
  overrides: {
    slug?: string;
    topic?: string;
    page?: string;
  } = {},
) {
  const slug = overrides.slug ?? "mars/why-mars";
  return {
    slug,
    topicSlug: slug.split("/")[0],
    topic: overrides.topic ?? "Mars Colonization",
    pageSlug: slug.split("/")[1],
    page: overrides.page ?? "Why Mars?",
    pageType: null,
    seedKeyword: null,
    tags: null,
    keywordCount: 42,
    maxVolume: 50000,
    totalVolume: 120000,
    minKd: 20,
    maxKd: 80,
    topKeywords: [
      {
        keyword: "why mars",
        volume: 50000,
        kd: 20,
        intent: "informational",
        cpc: "0.5",
        serpFeatures: "featured_snippet",
      },
    ],
  };
}

/**
 * Mock Q&A data
 */
export function createMockQaQuestion(
  overrides: {
    slug?: string;
    question?: string;
  } = {},
) {
  return {
    slug: overrides.slug ?? "is-elon-musk-a-trillionaire",
    question: overrides.question ?? "Is Elon Musk a Trillionaire?",
    parent: "elon musk net worth",
    answer:
      "As of 2025, Elon Musk's net worth fluctuates with Tesla stock prices and SpaceX valuations. While he has briefly surpassed the trillion-dollar mark during market peaks, his net worth typically ranges between $200-400 billion depending on stock performance.",
    sourceUrl: "https://example.com/article",
    sourceTitle: "Elon Musk Net Worth Analysis",
    volume: 25000,
  };
}

/**
 * Mock tweet data
 */
export function createMockTweet(
  overrides: {
    content?: string;
    handle?: string;
  } = {},
) {
  return {
    handle: overrides.handle ?? "elonmusk",
    tweetId: "1234567890",
    url: "https://x.com/elonmusk/status/1234567890",
    content:
      overrides.content ??
      "Mars is looking good today. The path to multi-planetary life is becoming clearer.",
    postedAt: new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
    raw: {
      id_str: "1234567890",
      created_at: new Date().toUTCString(),
      full_text: overrides.content ?? "Mars is looking good today",
      user: { screen_name: "elonmusk" },
    },
  };
}

/**
 * Mock video data
 */
export function createMockVideo(
  overrides: {
    videoId?: string;
    title?: string;
  } = {},
) {
  return {
    videoId: overrides.videoId ?? "abc123xyz",
    title:
      overrides.title ??
      "Elon Musk on Mars Colonization: SpaceX's Path to Multi-Planetary Life",
    link: "https://youtube.com/watch?v=abc123xyz",
    channel: "SpaceX",
    snippet: "Discussion about Mars plans and Starship development...",
    duration: "12:34",
    thumbnail: "https://example.com/thumb.jpg",
    publishedAt: new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
    sourceQuery: "elon musk mars",
  };
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse(overrides: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  body?: ReadableStream<Uint8Array> | null;
}) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => overrides.json ?? {},
    body: overrides.body ?? null,
    clone: function () {
      return { ...this };
    },
  } as Response;
}

/**
 * Create a mock stream for SSE testing
 */
export function createMockSSEStream(
  chunks: string[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  return new ReadableStream({
    start(controller) {
      const sendNext = () => {
        if (chunkIndex >= chunks.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ delta: chunks[chunkIndex] })}\n\n`,
          ),
        );
        chunkIndex++;
        setTimeout(sendNext, 10);
      };
      sendNext();
    },
  });
}

/**
 * Type guard for checking if error is a fetch error
 */
export function isFetchError(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}
