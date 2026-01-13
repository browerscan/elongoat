/**
 * E2E Test Setup
 *
 * This file runs before all E2E tests and configures the test environment.
 */

import { beforeAll, afterAll } from "vitest";

// E2E test configuration
export const e2eConfig = {
  baseUrl: process.env.TEST_API_URL ?? "http://localhost:3000",
  timeout: 30000,
  retries: 3,
  skipIfServerDown: process.env.SKIP_E2E_IF_SERVER_DOWN !== "false",
};

// Track test results
export const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
};

// Server health state
let serverHealthy = false;
let serverChecked = false;

/**
 * Health check helper - verifies the server is accessible
 */
export async function healthCheck(
  retries = 3,
): Promise<{ healthy: boolean; latency: number; error?: string }> {
  const start = Date.now();
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${e2eConfig.baseUrl}/api/health`, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (response.ok) {
        return { healthy: true, latency: Date.now() - start };
      }
    } catch (error) {
      lastError = error as Error;
      // Wait before retry (exponential backoff)
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  return {
    healthy: false,
    latency: Date.now() - start,
    error: lastError?.message ?? "Unknown error",
  };
}

/**
 * Check if E2E tests should run
 */
export async function shouldRunE2E(): Promise<boolean> {
  if (serverChecked) {
    return serverHealthy;
  }

  serverChecked = true;
  const result = await healthCheck();
  serverHealthy = result.healthy;

  if (!serverHealthy && e2eConfig.skipIfServerDown) {
    console.warn(
      `[E2E] Server not accessible at ${e2eConfig.baseUrl}. Skipping E2E tests.`,
    );
    console.warn(`[E2E] Error: ${result.error}`);
    console.warn(
      `[E2E] Start the server with 'npm run dev' or set TEST_API_URL to a running server.`,
    );
  }

  return serverHealthy;
}

// Global setup for E2E tests
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Log test configuration
  console.log(`[E2E] Testing against: ${e2eConfig.baseUrl}`);
  console.log(`[E2E] Test timeout: ${e2eConfig.timeout}ms`);
  console.log(`[E2E] Skip if server down: ${e2eConfig.skipIfServerDown}`);
});

// Global cleanup for E2E tests
afterAll(async () => {
  // Log test summary
  const total = testResults.passed + testResults.failed + testResults.skipped;
  console.log(`[E2E] Test Summary: ${total} total`);
  console.log(`  Passed: ${testResults.passed}`);
  console.log(`  Failed: ${testResults.failed}`);
  console.log(`  Skipped: ${testResults.skipped}`);
});
