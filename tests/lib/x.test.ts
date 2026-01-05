import { beforeEach, describe, expect, it, vi } from "vitest";

import { listXFollowing, listXTweets } from "../../src/lib/x";

// Mock dependencies
vi.mock("../../src/lib/db", () => ({
  getDbPool: vi.fn(),
}));

const mockDbQuery = vi.fn();
const mockDbPool = {
  query: mockDbQuery,
};

import { getDbPool } from "../../src/lib/db";

describe("x", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockDbQuery.mockReset();
  });

  const mockTweetRow = {
    handle: "elonmusk",
    tweet_id: "1234567890",
    url: "https://x.com/elonmusk/status/1234567890",
    content: "This is a test tweet",
    posted_at: "2024-01-01T00:00:00.000Z",
    scraped_at: "2024-01-02T00:00:00.000Z",
    raw: { id: "1234567890", text: "This is a test tweet" },
  };

  const mockFollowingRow = {
    handle: "elonmusk",
    following_handle: "nasa",
    scraped_at: "2024-01-02T00:00:00.000Z",
  };

  describe("listXTweets", () => {
    it("returns empty array when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await listXTweets({ handle: "elonmusk" });
      expect(result).toEqual([]);
    });

    it("returns empty array when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await listXTweets({ handle: "elonmusk" });
      expect(result).toEqual([]);
    });

    it("uses default limit of 60 when not specified", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "elonmusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 60],
      );
    });

    it("respects custom limit parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "elonmusk", limit: 20 });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 20],
      );
    });

    it("clamps limit to maximum of 200", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "elonmusk", limit: 500 });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 200],
      );
    });

    it("clamps limit to minimum of 1", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "elonmusk", limit: 0 });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 1],
      );
    });

    it("strips @ prefix from handle", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "@elonmusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(expect.any(String), [
        "elonmusk",
        expect.any(Number),
      ]);
    });

    it("lowercases the handle", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "ElonMusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(expect.any(String), [
        "elonmusk",
        expect.any(Number),
      ]);
    });

    it("trims whitespace from handle", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "  elonmusk  " });

      expect(mockDbQuery).toHaveBeenCalledWith(expect.any(String), [
        "elonmusk",
        expect.any(Number),
      ]);
    });

    it("maps database rows to XTweetRow format", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [mockTweetRow] });

      const result = await listXTweets({ handle: "elonmusk" });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        handle: "elonmusk",
        tweetId: "1234567890",
        url: "https://x.com/elonmusk/status/1234567890",
        content: "This is a test tweet",
        postedAt: "2024-01-01T00:00:00.000Z",
        scrapedAt: "2024-01-02T00:00:00.000Z",
        raw: { id: "1234567890", text: "This is a test tweet" },
      });
    });

    it("handles null posted_at", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [{ ...mockTweetRow, posted_at: null }],
      });

      const result = await listXTweets({ handle: "elonmusk" });

      expect(result[0]?.postedAt).toBeNull();
    });

    it("handles null optional fields", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            handle: "elonmusk",
            tweet_id: "123",
            url: null,
            content: null,
            posted_at: null,
            scraped_at: "2024-01-01T00:00:00.000Z",
            raw: null,
          },
        ],
      });

      const result = await listXTweets({ handle: "elonmusk" });

      expect(result[0]).toEqual({
        handle: "elonmusk",
        tweetId: "123",
        url: null,
        content: null,
        postedAt: null,
        scrapedAt: "2024-01-01T00:00:00.000Z",
        raw: null,
      });
    });

    it("orders by posted_at desc, scraped_at desc", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXTweets({ handle: "elonmusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "order by coalesce(posted_at, scraped_at) desc",
        ),
        expect.anything(),
      );
    });
  });

  describe("listXFollowing", () => {
    it("returns empty array when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await listXFollowing({ handle: "elonmusk" });
      expect(result).toEqual([]);
    });

    it("returns empty array when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await listXFollowing({ handle: "elonmusk" });
      expect(result).toEqual([]);
    });

    it("uses default limit of 2000 when not specified", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "elonmusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 2000],
      );
    });

    it("respects custom limit parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "elonmusk", limit: 500 });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 500],
      );
    });

    it("clamps limit to maximum of 5000", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "elonmusk", limit: 10000 });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 5000],
      );
    });

    it("clamps limit to minimum of 1", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "elonmusk", limit: -5 });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $2"),
        ["elonmusk", 1],
      );
    });

    it("strips @ prefix from handle", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "@elonmusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(expect.any(String), [
        "elonmusk",
        expect.any(Number),
      ]);
    });

    it("lowercases the handle", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "ElonMusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(expect.any(String), [
        "elonmusk",
        expect.any(Number),
      ]);
    });

    it("maps database rows to XFollowingRow format", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [mockFollowingRow] });

      const result = await listXFollowing({ handle: "elonmusk" });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        handle: "elonmusk",
        followingHandle: "nasa",
        scrapedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("orders by scraped_at desc, following_handle asc", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listXFollowing({ handle: "elonmusk" });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "order by scraped_at desc, following_handle asc",
        ),
        expect.anything(),
      );
    });
  });
});
