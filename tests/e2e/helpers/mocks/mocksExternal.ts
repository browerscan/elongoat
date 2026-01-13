/**
 * External Service Mocks for E2E Testing
 *
 * Vitest mocks for external dependencies like Redis, PostgreSQL,
 * and VectorEngine API.
 */

import { vi } from "vitest";

/**
 * Mock database pool factory
 */
export function createMockDbPool(
  overrides: {
    query?: ReturnType<typeof vi.fn>;
    connect?: ReturnType<typeof vi.fn>;
    end?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    query:
      overrides.query ?? vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect:
      overrides.connect ??
      vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: vi.fn(),
      }),
    end: overrides.end ?? vi.fn().mockResolvedValue(undefined),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
    options: { max: 10 },
  };
}

/**
 * Mock Redis client factory
 */
export function createMockRedisClient(
  overrides: {
    get?: ReturnType<typeof vi.fn>;
    set?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    eval?: ReturnType<typeof vi.fn>;
    ping?: ReturnType<typeof vi.fn>;
    connect?: ReturnType<typeof vi.fn>;
    quit?: ReturnType<typeof vi.fn>;
    info?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    set: overrides.set ?? vi.fn().mockResolvedValue("OK"),
    del: overrides.del ?? vi.fn().mockResolvedValue(1),
    eval: overrides.eval ?? vi.fn().mockResolvedValue([1, 60]), // [count, ttl] for rate limiting
    ping: overrides.ping ?? vi.fn().mockResolvedValue("PONG"),
    connect: overrides.connect ?? vi.fn().mockResolvedValue(undefined),
    quit: overrides.quit ?? vi.fn().mockResolvedValue("OK"),
    info:
      overrides.info ??
      vi
        .fn()
        .mockResolvedValue(
          "# Server\nredis_version:7.2.0\nredis_mode:standalone\n",
        ),
    status: "ready" as const,
    mget: vi.fn().mockResolvedValue([]),
    mset: vi.fn().mockResolvedValue("OK"),
    pipeline: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([]),
    }),
  };
}

/**
 * Mock VectorEngine API response
 */
export function createMockVectorEngineResponse(overrides: {
  text?: string;
  usage?: { total_tokens: number };
}) {
  return {
    choices: [
      {
        message: {
          content:
            overrides.text ?? "This is a test response from VectorEngine.",
        },
      },
    ],
    usage: overrides.usage ?? {
      prompt_tokens: 50,
      completion_tokens: 20,
      total_tokens: 70,
    },
  };
}

/**
 * Mock VectorEngine stream chunks
 */
export function createMockVectorEngineStreamChunks(
  responseText: string,
): string[] {
  const words = responseText.split(/\s+/);
  const chunks: string[] = [];

  for (const word of words) {
    chunks.push(word + " ");
  }

  return chunks;
}

/**
 * Mock Proxy-Grid SERP response
 */
export function createMockProxyGridSerpResponse(overrides: {
  query?: string;
  results?: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
}) {
  return {
    results: overrides.results ?? [
      {
        title: "Example Result 1",
        link: "https://example.com/1",
        snippet: "This is the first search result",
        position: 1,
      },
      {
        title: "Example Result 2",
        link: "https://example.com/2",
        snippet: "This is the second search result",
        position: 2,
      },
    ],
    peopleAlsoAsk: [
      {
        question: "What is an example question?",
        snippet: "This is an example answer",
        link: "https://example.com/q1",
        position: 1,
      },
    ],
    relatedSearches: ["example search 1", "example search 2"],
    totalResults: "1000000",
    searchTime: 0.5,
  };
}

/**
 * Environment variable helpers for testing
 */
export const mockEnv = {
  /**
   * Set a temporary environment variable with cleanup
   */
  set: (key: string, value: string): (() => void) => {
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
   * Unset an environment variable temporarily
   */
  unset: (key: string): (() => void) => {
    const original = process.env[key];
    delete process.env[key];
    return () => {
      if (original !== undefined) {
        process.env[key] = original;
      }
    };
  },

  /**
   * Set multiple environment variables at once
   */
  setMany: (envs: Record<string, string>): (() => void) => {
    const originals: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(envs)) {
      originals[key] = process.env[key];
      process.env[key] = value;
    }
    return () => {
      for (const [key, original] of Object.entries(originals)) {
        if (original === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = original;
        }
      }
    };
  },
};

/**
 * Mock Next.js NextRequest
 */
export function createMockNextRequest(overrides: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  json?: () => unknown | Promise<unknown>;
}) {
  const headers = new Headers(overrides.headers ?? {});

  return {
    url: overrides.url ?? "http://localhost:3000/api/test",
    method: overrides.method ?? "GET",
    headers,
    json:
      overrides.json ??
      (async () => (overrides.json ? await overrides.json() : {})),
    nextUrl: {
      pathname: "/api/test",
      searchParams: new URLSearchParams(),
    },
  } as unknown as Request;
}

/**
 * Mock fetch for external API calls
 */
export function mockFetch(overrides: {
  response?: Response | unknown;
  error?: Error | null;
}) {
  return vi.fn().mockImplementation(async () => {
    if (overrides.error) {
      throw overrides.error;
    }

    if (overrides.response instanceof Response) {
      return overrides.response;
    }

    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => overrides.response ?? {},
      text: async () => JSON.stringify(overrides.response ?? {}),
    } as Response;
  });
}
