/**
 * Test utilities for ElonGoat project
 *
 * This file provides common helpers, mocks, and fixtures for tests.
 */

import { vi } from "vitest";

/**
 * Creates a mock database pool with configurable query behavior
 */
export function createMockDbPool(
  overrides: {
    query?: ReturnType<typeof vi.fn>;
    end?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    query: overrides.query || vi.fn(),
    end: overrides.end || vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock Redis client
 */
export function createMockRedis(
  overrides: {
    get?: ReturnType<typeof vi.fn>;
    set?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    eval?: ReturnType<typeof vi.fn>;
    connect?: ReturnType<typeof vi.fn>;
    ping?: ReturnType<typeof vi.fn>;
    quit?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    get: overrides.get || vi.fn().mockResolvedValue(null),
    set: overrides.set || vi.fn().mockResolvedValue("OK"),
    del: overrides.del || vi.fn().mockResolvedValue(1),
    eval: overrides.eval || vi.fn().mockResolvedValue([1, 60]),
    connect: overrides.connect || vi.fn().mockResolvedValue(undefined),
    ping: overrides.ping || vi.fn().mockResolvedValue("PONG"),
    quit: overrides.quit || vi.fn().mockResolvedValue("OK"),
  };
}

/**
 * Mock database row factory
 */
export function createMockDbRow<T extends Record<string, unknown>>(data: T): T {
  return { ...data };
}

/**
 * Creates a mock database result
 */
export function createMockDbResult<T>(rows: T[] = []) {
  return {
    rows,
    rowCount: rows.length,
    command: "SELECT",
    fields: [],
    oid: 0,
  };
}

/**
 * Common test fixtures
 */
export const fixtures = {
  dynamicVariables: {
    age: 54,
    children_count: 14,
    net_worth: "$400B (example)",
    dob: "1971-06-28",
    updatedAt: new Date().toISOString(),
  },

  clusterPage: {
    slug: "mars/why-mars",
    topicSlug: "mars",
    topic: "Mars Colonization",
    pageSlug: "why-mars",
    page: "Why Mars?",
    pageType: null as string | null,
    seedKeyword: null as string | null,
    tags: null as string | null,
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
        serp_features: "featured_snippet",
      },
      {
        keyword: "mars colonization",
        volume: 30000,
        kd: 30,
        intent: "informational",
      },
    ],
  },

  paaQuestion: {
    slug: "is-elon-musk-a-trillionaire",
    question: "Is Elon Musk a Trillionaire?",
    parent: "elon musk net worth",
    answer: "As of 2025, Elon Musk's net worth fluctuates with Tesla stock...",
    sourceUrl: "https://example.com/article",
    sourceTitle: "Elon Musk Net Worth Analysis",
    volume: 25000,
  },

  chatConfig: {
    mood: "confident" as const,
    typingQuirk: true,
  },

  video: {
    videoId: "abc123xyz",
    title: "Elon Musk on Mars Colonization",
    link: "https://youtube.com/watch?v=abc123xyz",
    channel: "SpaceX",
    snippet: "Discussion about Mars plans...",
    duration: "12:34",
    thumbnail: "https://example.com/thumb.jpg",
    publishedAt: "2024-01-15T00:00:00.000Z",
    scrapedAt: "2024-01-16T00:00:00.000Z",
    sourceQuery: "elon musk mars",
  },

  tweet: {
    handle: "elonmusk",
    tweetId: "1234567890",
    url: "https://x.com/elonmusk/status/1234567890",
    content: "Mars is looking good today",
    postedAt: "2024-01-15T00:00:00.000Z",
    scrapedAt: "2024-01-15T00:01:00.000Z",
    raw: {
      id_str: "1234567890",
      created_at: "Mon Jan 15 00:00:00 +0000 2024",
      full_text: "Mars is looking good today",
      user: { screen_name: "elonmusk" },
    },
  },
} as const;

/**
 * Environment variable helpers for testing
 */
export const envHelpers = {
  /**
   * Sets an environment variable and returns a cleanup function
   */
  set: (key: string, value: string) => {
    const original = process.env[key];
    process.env[key] = value;
    return () => {
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    };
  },

  /**
   * Temporarily removes an environment variable
   */
  unset: (key: string) => {
    const original = process.env[key];
    delete process.env[key];
    return () => {
      if (original !== undefined) {
        process.env[key] = original;
      }
    };
  },

  /**
   * Runs a callback with temporary environment variables
   */
  with: async (
    env: Record<string, string | undefined>,
    callback: () => unknown | Promise<unknown>,
  ) => {
    const originals: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(env)) {
      originals[key] = process.env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    try {
      await callback();
    } finally {
      for (const [key, original] of Object.entries(originals)) {
        if (original === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = original;
        }
      }
    }
  },
};

/**
 * Async utilities for testing
 */
export const asyncHelpers = {
  /**
   * Waits for all pending promises to resolve
   */
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),

  /**
   * Creates a delay
   */
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Mock fetch response factory
 */
export function createMockResponse(overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => unknown | Promise<unknown>;
  text?: () => string | Promise<string>;
  body?: ReadableStream<Uint8Array> | null;
}) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? "OK",
    json: overrides.json ?? ((async () => ({})) as () => Promise<unknown>),
    text: overrides.text ?? ((async () => "") as () => Promise<string>),
    body: overrides.body ?? null,
    headers: new Headers({
      "content-type": "application/json",
    }),
  };
}

/**
 * Creates a streaming fetch response for SSE
 */
export function createMockSSEStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  return new ReadableStream<Uint8Array>({
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
