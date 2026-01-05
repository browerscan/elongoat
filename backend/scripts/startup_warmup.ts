/**
 * Startup Cache Warmup Script
 *
 * Runs on container startup to pre-warm critical caches.
 * Called as a background task after the server starts.
 *
 * Features:
 * - Pre-fetches top pages from content cache
 * - Warms Redis connection pool
 * - Pre-loads frequently accessed data
 * - Non-blocking - failures don't prevent startup
 */

import "dotenv/config";

import { getEnv } from "../lib/env";

const env = getEnv();
const API_URL =
  env.NEXT_PUBLIC_API_URL || env.API_URL || "http://localhost:3000";
const WARMUP_DELAY_MS = env.WARMUP_DELAY_MS;
const WARMUP_CONCURRENCY = env.WARMUP_CONCURRENCY;

interface WarmupResult {
  endpoint: string;
  success: boolean;
  latency: number;
  error?: string;
}

/**
 * Warm up a single endpoint
 */
async function warmEndpoint(endpoint: string): Promise<WarmupResult> {
  const start = performance.now();

  try {
    const response = await fetch(API_URL + endpoint, {
      method: "GET",
      headers: {
        "User-Agent": "elongoat-warmup/1.0",
      },
    });

    const latency = Math.round(performance.now() - start);

    return {
      endpoint,
      success: response.ok,
      latency,
      error: response.ok ? undefined : "HTTP " + response.status,
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    return {
      endpoint,
      success: false,
      latency,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process endpoints in parallel with concurrency limit
 */
async function warmEndpoints(
  endpoints: string[],
  concurrency: number,
): Promise<WarmupResult[]> {
  const results: WarmupResult[] = [];

  for (let i = 0; i < endpoints.length; i += concurrency) {
    const batch = endpoints.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(warmEndpoint));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Main warmup function
 */
async function main() {
  console.log("[warmup] Starting cache warmup...");
  console.log("[warmup] API URL:", API_URL);
  console.log("[warmup] Delay:", WARMUP_DELAY_MS + "ms");
  console.log("[warmup] Concurrency:", WARMUP_CONCURRENCY);

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, WARMUP_DELAY_MS));

  // Critical endpoints to warm up
  const endpoints = [
    // Health check first
    "/api/health",

    // Core data endpoints
    "/api/data/cluster",
    "/api/data/qa",

    // Variables (frequently accessed)
    "/api/variables",

    // RAG endpoints (if available)
    "/api/rag/health",
    "/api/rag/stats",

    // Top topic pages (will be expanded dynamically)
    "/topics",
  ];

  const startTime = performance.now();
  const results = await warmEndpoints(endpoints, WARMUP_CONCURRENCY);
  const totalTime = Math.round(performance.now() - startTime);

  // Report results
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const avgLatency =
    results.reduce((sum, r) => sum + r.latency, 0) / results.length;

  console.log("[warmup] Warmup complete:");
  console.log("  - Total time:", totalTime + "ms");
  console.log("  - Endpoints:", results.length);
  console.log("  - Succeeded:", succeeded);
  console.log("  - Failed:", failed);
  console.log("  - Avg latency:", Math.round(avgLatency) + "ms");

  if (failed > 0) {
    console.log("[warmup] Failed endpoints:");
    for (const result of results.filter((r) => !r.success)) {
      console.log("  -", result.endpoint + ":", result.error);
    }
  }
}

// Run with error handling
main().catch((error) => {
  console.error("[warmup] Critical error:", error);
  // Don't exit with error - warmup failure shouldn't prevent startup
});
