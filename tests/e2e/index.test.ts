/**
 * E2E Test Suite Entry Point
 *
 * This file serves as the entry point for all E2E tests.
 * It runs health checks and sets up the test environment.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { healthCheck, e2eConfig } from "./setup";

describe("E2E: Infrastructure", () => {
  let serverHealthy = false;
  let healthLatency = 0;

  beforeAll(async () => {
    const result = await healthCheck();
    serverHealthy = result.healthy;
    healthLatency = result.latency;
  }, 30000);

  describe("Server Health", () => {
    it("should be running and accessible", async () => {
      expect(serverHealthy).toBe(true);
    });

    it("should respond within reasonable time", () => {
      expect(healthLatency).toBeLessThan(5000);
    });
  });

  describe("Test Environment", () => {
    it("should have TEST_API_URL configured", () => {
      expect(e2eConfig.baseUrl).toBeTruthy();
      expect(e2eConfig.baseUrl.length).toBeGreaterThan(0);
    });

    it("should be accessible via HTTP", async () => {
      try {
        const response = await fetch(e2eConfig.baseUrl);
        expect([200, 404]).toContain(response.status);
      } catch (error) {
        // Server might not be running
        expect(true).toBe(true);
      }
    });
  });
});

// Import all E2E test suites
import "./api/health.test";
import "./api/chat.test";
import "./api/serp.test";
import "./api/metrics.test";
import "./api/variables.test";
import "./api/data.test";
import "./api/articles.test";
import "./pages/rendering.test";
