/**
 * E2E Tests for /api/health Endpoint
 *
 * Tests the health check endpoint including component status,
 * system metrics, and error handling.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TestClient, shouldRunE2E } from "../helpers";

describe("API: /api/health", () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await shouldRunE2E();
  });

  const client = new TestClient({
    baseUrl: process.env.TEST_API_URL ?? "http://localhost:3000",
  });

  const runIf = (condition: boolean) => (condition ? it : it.skip);

  describe("GET /api/health", () => {
    runIf(serverAvailable)("should return 200 and health status", async () => {
      const response = await client.get("/api/health");

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data).toBeTruthy();
    });

    runIf(serverAvailable)("should include overall status field", async () => {
      const response = await client.get("/api/health");

      expect(response.data).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy"]).includes(
        (response.data as { status: string }).status,
      );
    });

    runIf(serverAvailable)("should include timestamp", async () => {
      const response = await client.get("/api/health");

      expect(response.data).toHaveProperty("timestamp");
      const timestamp = (response.data as { timestamp: string }).timestamp;
      expect(new Date(timestamp)).toBeInstanceOf(Date);
    });

    runIf(serverAvailable)(
      "should include component health checks",
      async () => {
        const response = await client.get("/api/health");

        expect(response.data).toHaveProperty("components");
        const components = (response.data as { components: unknown })
          .components;

        expect(components).toHaveProperty("database");
        expect(components).toHaveProperty("redis");
        expect(components).toHaveProperty("vectorEngine");
      },
    );

    runIf(serverAvailable)("should include system metrics", async () => {
      const response = await client.get("/api/health");

      expect(response.data).toHaveProperty("metrics");
      const metrics = (response.data as { metrics: unknown }).metrics;

      expect(metrics).toHaveProperty("memoryUsedMb");
      expect(metrics).toHaveProperty("uptimeSeconds");
      expect(metrics).toHaveProperty("nodeVersion");
    });

    runIf(serverAvailable)("should include check summary", async () => {
      const response = await client.get("/api/health");

      expect(response.data).toHaveProperty("checks");
      const checks = (response.data as { checks: unknown }).checks;

      expect(checks).toHaveProperty("count");
      expect(checks).toHaveProperty("passed");
      expect(checks).toHaveProperty("failed");
      expect(checks).toHaveProperty("skipped");
    });

    runIf(serverAvailable)("should return 503 when unhealthy", async () => {
      const response = await client.get("/api/health");

      if ((response.data as { status: string }).status === "unhealthy") {
        expect(response.status).toBe(503);
      }
    });
  });

  describe("HEAD /api/health", () => {
    runIf(serverAvailable)(
      "should return 200 for simple liveness check",
      async () => {
        const url = new URL("/api/health", client["baseUrl"]).toString();

        const response = await fetch(url, { method: "HEAD" });

        expect(response.status).toBe(200);
      },
    );
  });

  describe("Component Health Details", () => {
    runIf(serverAvailable)(
      "should include database component details",
      async () => {
        const response = await client.get("/api/health");

        const components = (
          response.data as { components: { database: unknown } }
        ).components;
        const db = components.database;

        expect(db).toHaveProperty("status");
        expect(db).toHaveProperty("latency");
      },
    );

    runIf(serverAvailable)(
      "should include redis component details",
      async () => {
        const response = await client.get("/api/health");

        const components = (response.data as { components: { redis: unknown } })
          .components;
        const redis = components.redis;

        expect(redis).toHaveProperty("status");
        expect(redis).toHaveProperty("latency");
      },
    );

    runIf(serverAvailable)(
      "should include vectorEngine component details",
      async () => {
        const response = await client.get("/api/health");

        const components = (
          response.data as {
            components: { vectorEngine: unknown };
          }
        ).components;
        const ve = components.vectorEngine;

        expect(ve).toHaveProperty("status");
        expect(ve).toHaveProperty("latency");
      },
    );
  });

  describe("Performance Metrics", () => {
    runIf(serverAvailable)("should include cache health", async () => {
      const response = await client.get("/api/health");

      expect(response.data).toHaveProperty("performance");
      const performance = (response.data as { performance: unknown })
        .performance;

      expect(performance).toHaveProperty("cache");
      expect(performance).toHaveProperty("aggregate");
    });

    runIf(serverAvailable)(
      "should include aggregate request metrics",
      async () => {
        const response = await client.get("/api/health");

        const performance = (
          response.data as {
            performance: { aggregate: unknown };
          }
        ).performance;
        const aggregate = performance.aggregate;

        expect(aggregate).toHaveProperty("requestCount");
        expect(aggregate).toHaveProperty("averageLatency");
        expect(aggregate).toHaveProperty("p95Latency");
        expect(aggregate).toHaveProperty("errorRate");
      },
    );
  });

  describe("Response Headers", () => {
    runIf(serverAvailable)("should include rate limit headers", async () => {
      const response = await client.get("/api/health");

      expect(response.headers.has("x-ratelimit-limit")).toBe(true);
      expect(response.headers.has("x-ratelimit-remaining")).toBe(true);
    });

    runIf(serverAvailable)(
      "should include health check duration header",
      async () => {
        const response = await client.get("/api/health");

        expect(response.headers.has("x-health-check-duration")).toBe(true);
        const duration = response.headers.get("x-health-check-duration");
        expect(duration).toMatch(/\d+ms/);
      },
    );

    runIf(serverAvailable)("should include health status header", async () => {
      const response = await client.get("/api/health");

      expect(response.headers.has("x-health-status")).toBe(true);
      const status = response.headers.get("x-health-status");
      expect(["healthy", "degraded", "unhealthy"]).includes(
        status ?? "unknown",
      );
    });
  });

  describe("Error Handling", () => {
    runIf(serverAvailable)("should handle rate limiting", async () => {
      const requests = Array.from({ length: 100 }, () =>
        client.get("/api/health"),
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some((r) => r.status === 429);

      if (rateLimited) {
        const rateLimitedResponse = responses.find((r) => r.status === 429);
        expect(rateLimitedResponse?.data).toHaveProperty("error");
      }
    });
  });
});
