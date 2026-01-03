// Server-only module (import removed for backend compatibility)

import { getCircuitBreaker } from "./circuitBreaker";
import { withRetry } from "./retry";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
    text?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

// Error types that should trigger retry
const RETRYABLE_ERROR_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
  /timeout/i,
  /fetch failed/i,
  /network/i,
  /502/,
  /503/,
  /504/,
];

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    return RETRYABLE_ERROR_PATTERNS.some((pattern) =>
      pattern.test(error.message),
    );
  }
  return false;
}

export function getVectorEngineChatUrl(): string | null {
  if (!process.env.VECTORENGINE_API_KEY) return null;
  const baseUrl =
    process.env.VECTORENGINE_BASE_URL ?? "https://api.vectorengine.ai";
  const url =
    process.env.VECTORENGINE_API_URL ??
    `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  return url;
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number },
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

export async function vectorEngineChatComplete(params: {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}): Promise<{ text: string; usage?: { totalTokens?: number } }> {
  const key = process.env.VECTORENGINE_API_KEY;
  const url = getVectorEngineChatUrl();
  if (!key || !url) {
    throw new Error(
      "VectorEngine not configured (missing VECTORENGINE_API_KEY)",
    );
  }

  // Use circuit breaker with P0 config: threshold=3, timeout=30000, resetTimeout=60000
  const circuitBreaker = getCircuitBreaker("vectorengine", {
    threshold: 3,
    timeout: params.timeout ?? 30000,
    resetTimeout: 60000,
  });

  // Wrap with retry logic for transient failures
  return withRetry(
    async () => {
      const res = await circuitBreaker.execute(async () => {
        return fetchWithTimeout(url, {
          method: "POST",
          timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            stream: false,
            temperature: params.temperature ?? 0.4,
            max_tokens: params.maxTokens ?? 900,
          }),
        });
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `VectorEngine error ${res.status}: ${text.slice(0, 300)}`,
        );
      }

      const json = (await res.json()) as ChatCompletionResponse;
      const content =
        json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? "";
      return {
        text: typeof content === "string" ? content : "",
        usage: { totalTokens: json.usage?.total_tokens },
      };
    },
    {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: isRetryableError,
    },
  );
}

/**
 * Stream chat completion with timeout
 */
export async function vectorEngineChatStream(params: {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.VECTORENGINE_API_KEY;
  const url = getVectorEngineChatUrl();
  if (!key || !url) {
    throw new Error(
      "VectorEngine not configured (missing VECTORENGINE_API_KEY)",
    );
  }

  // Use circuit breaker with P0 config for streaming
  const circuitBreaker = getCircuitBreaker("vectorengine-stream", {
    threshold: 3,
    timeout: params.timeout ?? 30000,
    resetTimeout: 60000,
  });

  // Wrap with retry logic for streaming
  return withRetry(
    async () => {
      const res = await circuitBreaker.execute(async () => {
        return fetchWithTimeout(url, {
          method: "POST",
          timeout: params.timeout ?? DEFAULT_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            stream: true,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 900,
          }),
        });
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `VectorEngine error ${res.status}: ${text.slice(0, 300)}`,
        );
      }

      if (!res.body) {
        throw new Error("No response body from VectorEngine");
      }

      return res.body;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: isRetryableError,
    },
  );
}
