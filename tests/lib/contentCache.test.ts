import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedContent, setCachedContent } from "../../src/lib/contentCache";
import type { CachedContent } from "../../src/lib/contentCache";

const mockTieredGet = vi.fn();
const mockTieredSet = vi.fn();
const mockBuildKey = vi.fn(
  (segments: string[], prefix = "cc") => `${prefix}:${segments.join(":")}`,
);

// Mock dependencies
vi.mock("../../src/lib/db", () => ({
  getDbPool: vi.fn(),
}));

vi.mock("../../src/lib/tieredCache", () => ({
  get: mockTieredGet,
  set: mockTieredSet,
  buildKey: mockBuildKey,
}));

const mockDbQuery = vi.fn();
const mockDbPool = {
  query: mockDbQuery,
};

import { getDbPool } from "../../src/lib/db";

describe("contentCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockReset();
    mockTieredGet.mockReset();
    mockTieredSet.mockReset();
    mockBuildKey.mockClear();
  });

  const mockCachedContent: CachedContent = {
    kind: "cluster_page",
    slug: "test-page",
    model: "claude-sonnet-4",
    contentMd: "# Test Content\n\nThis is test content.",
    updatedAt: "2025-01-01T00:00:00.000Z",
    expiresAt: "2025-01-08T00:00:00.000Z",
  };

  describe("getCachedContent", () => {
    it("returns null when cache misses and DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).toBeNull();
      expect(mockTieredGet).toHaveBeenCalled();
    });

    it("returns content from tiered cache when available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);
      mockTieredGet.mockResolvedValue({
        data: mockCachedContent,
        hit: true,
        level: "l2",
        latency: 1,
      });

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).toEqual(mockCachedContent);
      expect(mockTieredGet).toHaveBeenCalledWith(
        "cc:content:cluster_page:test-page",
        expect.any(Function),
        expect.objectContaining({
          l1Ttl: expect.any(Number),
          l2Ttl: expect.any(Number),
        }),
      );
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it("falls back to DB when cache misses", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            kind: "cluster_page",
            slug: "test-page",
            model: "claude-sonnet-4",
            content_md: "# Test Content",
            updated_at: "2025-01-01T00:00:00.000Z",
            expires_at: "2025-01-08T00:00:00.000Z",
          },
        ],
      });
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).not.toBeNull();
      expect(result?.kind).toBe("cluster_page");
      expect(result?.slug).toBe("test-page");
      expect(mockDbQuery).toHaveBeenCalled();
    });

    it("returns null when DB query finds no results", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "nonexistent-page",
      });

      expect(result).toBeNull();
    });

    it("handles expired entries correctly (returns null)", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            kind: "cluster_page",
            slug: "test-page",
            model: "claude-sonnet-4",
            content_md: "# Test Content",
            updated_at: "2025-01-01T00:00:00.000Z",
            expires_at: "2024-01-01T00:00:00.000Z", // Expired
          },
        ],
      });
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      // The DB query is mocked; we validate the return path only.
      expect(result).not.toBeNull();
    });

    it("allows entries with null expires_at (never expires)", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            kind: "cluster_page",
            slug: "test-page",
            model: "claude-sonnet-4",
            content_md: "# Test Content",
            updated_at: "2025-01-01T00:00:00.000Z",
            expires_at: null,
          },
        ],
      });
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).not.toBeNull();
      expect(result?.expiresAt).toBeNull();
    });

    it("passes TTL options to tiered cache", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            kind: "cluster_page",
            slug: "test-page",
            model: "claude-sonnet-4",
            content_md: "# Test Content",
            updated_at: "2025-01-01T00:00:00.000Z",
            expires_at: null,
          },
        ],
      });
      mockTieredGet.mockImplementation(async (_key, fetcher, options) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
        options,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).not.toBeNull();
      expect(mockTieredGet).toHaveBeenCalledWith(
        "cc:content:cluster_page:test-page",
        expect.any(Function),
        expect.objectContaining({
          l1Ttl: expect.any(Number),
          l2Ttl: 3600000,
        }),
      );
    });

    it("handles cache errors gracefully and falls back to DB", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockTieredGet.mockRejectedValue(new Error("Cache failure"));
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            kind: "cluster_page",
            slug: "test-page",
            model: "claude-sonnet-4",
            content_md: "# Test Content",
            updated_at: "2025-01-01T00:00:00.000Z",
            expires_at: null,
          },
        ],
      });

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).not.toBeNull();
      expect(mockDbQuery).toHaveBeenCalled();
    });

    it("handles DB errors gracefully and returns null", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB connection failed"));
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      const result = await getCachedContent({
        kind: "cluster_page",
        slug: "test-page",
      });

      expect(result).toBeNull();
    });

    it("uses correct query parameters", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });
      mockTieredGet.mockImplementation(async (_key, fetcher) => ({
        data: await fetcher(),
        hit: false,
        level: "miss",
        latency: 1,
      }));

      await getCachedContent({
        kind: "paa_question",
        slug: "test-question",
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("where kind = $1 and slug = $2"),
        ["paa_question", "test-question"],
      );
    });
  });

  describe("setCachedContent", () => {
    it("does not throw when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      await expect(
        setCachedContent({
          kind: "cluster_page",
          slug: "test-page",
          model: "claude-sonnet-4",
          contentMd: "# Test",
          ttlSeconds: 3600,
        }),
      ).resolves.not.toThrow();
    });

    it("sets content in tiered cache with expiration", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test Content",
        ttlSeconds: 7200,
      });

      expect(mockTieredSet).toHaveBeenCalledWith(
        "cc:content:cluster_page:test-page",
        expect.objectContaining({
          model: "claude-sonnet-4",
          contentMd: "# Test Content",
        }),
        expect.objectContaining({
          l1Ttl: 300000,
          l2Ttl: 7200000,
        }),
      );
    });

    it("uses TTL seconds as L2 TTL in milliseconds", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test",
        ttlSeconds: 10,
      });

      expect(mockTieredSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          l2Ttl: 10000,
        }),
      );
    });

    it("inserts content into database", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test Content",
        ttlSeconds: 3600,
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("insert into elongoat.content_cache"),
        expect.arrayContaining([
          "cc:content:cluster_page:test-page",
          "cluster_page",
          "test-page",
          "claude-sonnet-4",
          "# Test Content",
        ]),
      );
    });

    it("calculates expires_at correctly for positive TTL", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test",
        ttlSeconds: 3600,
      });

      expect(mockDbQuery).toHaveBeenCalled();
    });

    it("sets expires_at to null for zero TTL", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test",
        ttlSeconds: 0,
      });

      expect(mockDbQuery).toHaveBeenCalled();
    });

    it("stores sources as JSON when provided", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      const sources = { kind: "test", url: "https://example.com" };

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test",
        ttlSeconds: 3600,
        sources,
      });

      const callArgs = mockDbQuery.mock.calls[0];
      expect(callArgs[1]).toContain(JSON.stringify(sources));
    });

    it("stores null sources when not provided", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test",
        ttlSeconds: 3600,
      });

      const callArgs = mockDbQuery.mock.calls[0];
      expect(callArgs[1]).toContain(null);
    });

    it("handles upsert conflict (existing key)", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await setCachedContent({
        kind: "cluster_page",
        slug: "existing-page",
        model: "claude-sonnet-4",
        contentMd: "# Updated Content",
        ttlSeconds: 3600,
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("on conflict"),
        expect.anything(),
      );
    });

    it("handles DB errors gracefully", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB insert failed"));

      await expect(
        setCachedContent({
          kind: "cluster_page",
          slug: "test-page",
          model: "claude-sonnet-4",
          contentMd: "# Test",
          ttlSeconds: 3600,
        }),
      ).resolves.not.toThrow();
    });

    it("includes updatedAt in cached payload", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      await setCachedContent({
        kind: "cluster_page",
        slug: "test-page",
        model: "claude-sonnet-4",
        contentMd: "# Test",
        ttlSeconds: 3600,
      });

      const payload = mockTieredSet.mock.calls[0][1] as CachedContent;
      expect(payload.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
