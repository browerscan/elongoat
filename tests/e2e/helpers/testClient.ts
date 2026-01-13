/**
 * Test HTTP Client for E2E API Testing
 *
 * Provides a wrapper around fetch for testing API endpoints with
 * proper authentication, error handling, and response parsing.
 */

interface TestClientOptions {
  baseUrl?: string;
  authToken?: string;
  headers?: Record<string, string>;
}

interface TestResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  data: T | null;
  error: string | null;
}

export type { TestClientOptions, TestResponse };

export class TestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: TestClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:3000";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (options.authToken) {
      this.defaultHeaders["Authorization"] = `Bearer ${options.authToken}`;
    }
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    path: string,
    options?: {
      query?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<TestResponse<T>> {
    const url = this.buildUrl(path, options?.query);
    const headers = { ...this.defaultHeaders, ...options?.headers };

    return this.request<T>(url, { method: "GET", headers });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<TestResponse<T>> {
    const url = this.buildUrl(path);
    const headers = { ...this.defaultHeaders, ...options?.headers };

    return this.request<T>(url, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<TestResponse<T>> {
    const url = this.buildUrl(path);
    const headers = { ...this.defaultHeaders, ...options?.headers };

    return this.request<T>(url, {
      method: "PUT",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(
    path: string,
    options?: { headers?: Record<string, string> },
  ): Promise<TestResponse<T>> {
    const url = this.buildUrl(path);
    const headers = { ...this.defaultHeaders, ...options?.headers };

    return this.request<T>(url, { method: "DELETE", headers });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<TestResponse<T>> {
    const url = this.buildUrl(path);
    const headers = { ...this.defaultHeaders, ...options?.headers };

    return this.request<T>(url, {
      method: "PATCH",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Stream a response (for SSE testing)
   */
  async stream(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<ReadableStream<Uint8Array> | null> {
    const url = this.buildUrl(path);
    const headers = { ...this.defaultHeaders, ...options?.headers };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        return null;
      }

      return response.body;
    } catch {
      return null;
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      });
    }

    return url.toString();
  }

  /**
   * Make a request and parse the response
   */
  private async request<T>(
    url: string,
    init: RequestInit,
  ): Promise<TestResponse<T>> {
    try {
      const response = await fetch(url, init);
      const headers = new Headers(response.headers);

      let data: T | null = null;
      let error: string | null = null;

      const contentType = headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const cloned = response.clone();
        try {
          data = await cloned.json();
        } catch {
          // Failed to parse JSON
        }
      }

      if (!response.ok) {
        error = data
          ? JSON.stringify(data)
          : response.statusText || "Request failed";
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        data,
        error,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        statusText: "Network Error",
        headers: new Headers(),
        data: null,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Create a new client with different auth token
   */
  withAuth(authToken: string): TestClient {
    return new TestClient({
      baseUrl: this.baseUrl,
      authToken,
      headers: this.defaultHeaders,
    });
  }

  /**
   * Create a new client with different base URL
   */
  withBaseUrl(baseUrl: string): TestClient {
    return new TestClient({
      baseUrl,
      authToken: this.defaultHeaders["Authorization"]?.replace("Bearer ", ""),
      headers: this.defaultHeaders,
    });
  }
}

/**
 * Helper to read a stream completely
 */
export async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  return result;
}

/**
 * Helper to parse SSE stream chunks
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Array<{ type: string; delta?: string; done?: boolean }>> {
  const text = await readStream(stream);
  const events: Array<{ type: string; delta?: string; done?: boolean }> = [];

  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (data === "[DONE]") {
        events.push({ type: "done", done: true });
      } else {
        try {
          const parsed = JSON.parse(data);
          events.push(parsed);
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  return events;
}
