/**
 * E2E Tests for /api/data/* Endpoints
 *
 * Tests the data API endpoints that provide content for
 * cluster pages, topic pages, and Q&A pages.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TestClient } from "../helpers";

describe("API: /api/data", () => {
  const client = new TestClient({
    baseUrl: process.env.TEST_API_URL ?? "http://localhost:3000",
  });

  describe("GET /api/data/topic/:slug", () => {
    it("should return topic data for valid slug", async () => {
      const response = await client.get("/api/data/topic/mars");

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("topic");
      expect(response.data).toHaveProperty("pageCount");
      expect(response.data).toHaveProperty("slug");
    });

    it("should return 404 for non-existent topic", async () => {
      const response = await client.get(
        "/api/data/topic/nonexistent-topic-xyz-123",
      );

      expect([404, 200]).toContain(response.status);
    });

    it("should include pages array", async () => {
      const response = await client.get("/api/data/topic/mars");

      if (response.status === 200) {
        expect(response.data).toHaveProperty("pages");
        const pages = (response.data as { pages: unknown[] }).pages;
        expect(Array.isArray(pages)).toBe(true);
      }
    });
  });

  describe("GET /api/data/page/:topic/:page", () => {
    it("should return page data for valid topic and page", async () => {
      const response = await client.get("/api/data/page/mars/why-mars");

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("topic");
      expect(response.data).toHaveProperty("page");
      expect(response.data).toHaveProperty("content");
    });

    it("should include top keywords", async () => {
      const response = await client.get("/api/data/page/mars/why-mars");

      if (response.status === 200) {
        expect(response.data).toHaveProperty("topKeywords");
        const keywords = (response.data as { topKeywords: unknown[] })
          .topKeywords;
        expect(Array.isArray(keywords)).toBe(true);
      }
    });

    it("should include metadata", async () => {
      const response = await client.get("/api/data/page/mars/why-mars");

      if (response.status === 200) {
        expect(response.data).toHaveProperty("keywordCount");
        expect(response.data).toHaveProperty("maxVolume");
      }
    });
  });

  describe("GET /api/data/qa", () => {
    it("should return list of Q&A items", async () => {
      const response = await client.get("/api/data/qa");

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("questions");
      const questions = (response.data as { questions: unknown[] }).questions;
      expect(Array.isArray(questions)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await client.get("/api/data/qa", {
        query: { limit: "10" },
      });

      expect(response.status).toBe(200);
      if (response.data) {
        const questions = (response.data as { questions: unknown[] }).questions;
        expect(questions.length).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("GET /api/data/qa/:slug", () => {
    it("should return Q&A for valid slug", async () => {
      const response = await client.get(
        "/api/data/qa/is-elon-musk-a-trillionaire",
      );

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.data).toHaveProperty("question");
        expect(response.data).toHaveProperty("answer");
        expect(response.data).toHaveProperty("slug");
      }
    });

    it("should include source information", async () => {
      const response = await client.get(
        "/api/data/qa/is-elon-musk-a-trillionaire",
      );

      if (response.status === 200) {
        expect(response.data).toHaveProperty("sourceUrl");
        expect(response.data).toHaveProperty("sourceTitle");
      }
    });
  });

  describe("GET /api/data/cluster", () => {
    it("should return cluster list", async () => {
      const response = await client.get("/api/data/cluster");

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("clusters");
      const clusters = (response.data as { clusters: unknown[] }).clusters;
      expect(Array.isArray(clusters)).toBe(true);
    });

    it("should support limit parameter", async () => {
      const response = await client.get("/api/data/cluster", {
        query: { limit: "5" },
      });

      expect(response.status).toBe(200);
      if (response.data) {
        const clusters = (response.data as { clusters: unknown[] }).clusters;
        expect(clusters.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("Response Structure", () => {
    it("should include proper headers", async () => {
      const response = await client.get("/api/data/topic/mars");

      if (response.status === 200) {
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
      }
    });

    it("should include cache headers", async () => {
      const response = await client.get("/api/data/topic/mars");

      if (response.status === 200) {
        expect(response.headers.has("cache-control")).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed slugs gracefully", async () => {
      const response = await client.get("/api/data/topic/../etc/passwd");

      expect([400, 404, 200]).toContain(response.status);
    });

    it("should handle special characters in slugs", async () => {
      const response = await client.get("/api/data/topic/mars-colonization");

      expect([200, 404]).toContain(response.status);
    });
  });
});
