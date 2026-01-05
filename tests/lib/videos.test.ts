import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTranscript, getVideo, listVideos } from "../../src/lib/videos";

// Mock dependencies
vi.mock("../../src/lib/db", () => ({
  getDbPool: vi.fn(),
}));

const mockDbQuery = vi.fn();
const mockDbPool = {
  query: mockDbQuery,
};

import { getDbPool } from "../../src/lib/db";

describe("videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockDbQuery.mockReset();
  });

  const mockVideoRow = {
    video_id: "abc123",
    title: "Test Video Title",
    link: "https://youtube.com/watch?v=abc123",
    channel: "Test Channel",
    snippet: "Video snippet here",
    duration: "10:35",
    thumbnail: "https://example.com/thumb.jpg",
    published_at: "2024-01-01T00:00:00.000Z",
    scraped_at: "2024-01-02T00:00:00.000Z",
    source_query: "elon musk",
  };

  const mockTranscriptRow = {
    video_id: "abc123",
    transcript_text: "This is the full transcript text...",
    fetched_at: "2024-01-03T00:00:00.000Z",
  };

  describe("listVideos", () => {
    it("returns empty array when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await listVideos();
      expect(result).toEqual([]);
    });

    it("returns empty array when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await listVideos();
      expect(result).toEqual([]);
    });

    it("queries with default limit of 50", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listVideos();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [50],
      );
    });

    it("respects custom limit parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listVideos(25);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [25],
      );
    });

    it("maps database rows to VideoRow format", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [mockVideoRow] });

      const result = await listVideos();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        videoId: "abc123",
        title: "Test Video Title",
        link: "https://youtube.com/watch?v=abc123",
        channel: "Test Channel",
        snippet: "Video snippet here",
        duration: "10:35",
        thumbnail: "https://example.com/thumb.jpg",
        publishedAt: "2024-01-01T00:00:00.000Z",
        scrapedAt: "2024-01-02T00:00:00.000Z",
        sourceQuery: "elon musk",
      });
    });

    it("handles null published_at correctly", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [{ ...mockVideoRow, published_at: null }],
      });

      const result = await listVideos();

      expect(result[0]?.publishedAt).toBeNull();
    });

    it("handles null optional fields", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            video_id: "xyz789",
            title: null,
            link: null,
            channel: null,
            snippet: null,
            duration: null,
            thumbnail: null,
            published_at: null,
            scraped_at: "2024-01-02T00:00:00.000Z",
            source_query: null,
          },
        ],
      });

      const result = await listVideos();

      expect(result[0]).toEqual({
        videoId: "xyz789",
        title: null,
        link: null,
        channel: null,
        snippet: null,
        duration: null,
        thumbnail: null,
        publishedAt: null,
        scrapedAt: "2024-01-02T00:00:00.000Z",
        sourceQuery: null,
      });
    });

    it("orders by scraped_at desc", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listVideos();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("order by scraped_at desc"),
        expect.anything(),
      );
    });
  });

  describe("getTranscript", () => {
    it("returns null when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await getTranscript("abc123");
      expect(result).toBeNull();
    });

    it("returns null when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await getTranscript("abc123");
      expect(result).toBeNull();
    });

    it("returns null when transcript not found", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getTranscript("nonexistent");
      expect(result).toBeNull();
    });

    it("returns transcript row when found", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [mockTranscriptRow] });

      const result = await getTranscript("abc123");

      expect(result).toEqual({
        videoId: "abc123",
        transcriptText: "This is the full transcript text...",
        fetchedAt: "2024-01-03T00:00:00.000Z",
      });
    });

    it("queries with video_id parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await getTranscript("test-video-id");

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("where video_id = $1"),
        ["test-video-id"],
      );
    });

    it("handles null transcript_text", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [{ ...mockTranscriptRow, transcript_text: null }],
      });

      const result = await getTranscript("abc123");

      expect(result?.transcriptText).toBeNull();
    });
  });

  describe("getVideo", () => {
    it("returns null when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await getVideo("abc123");
      expect(result).toBeNull();
    });

    it("returns null when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await getVideo("abc123");
      expect(result).toBeNull();
    });

    it("returns null when video not found", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getVideo("nonexistent");
      expect(result).toBeNull();
    });

    it("returns video row when found", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [mockVideoRow] });

      const result = await getVideo("abc123");

      expect(result).toEqual({
        videoId: "abc123",
        title: "Test Video Title",
        link: "https://youtube.com/watch?v=abc123",
        channel: "Test Channel",
        snippet: "Video snippet here",
        duration: "10:35",
        thumbnail: "https://example.com/thumb.jpg",
        publishedAt: "2024-01-01T00:00:00.000Z",
        scrapedAt: "2024-01-02T00:00:00.000Z",
        sourceQuery: "elon musk",
      });
    });

    it("queries with video_id parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await getVideo("test-video-id");

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("where video_id = $1"),
        ["test-video-id"],
      );
    });

    it("handles null optional fields", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            video_id: "minimal",
            title: null,
            link: null,
            channel: null,
            snippet: null,
            duration: null,
            thumbnail: null,
            published_at: null,
            scraped_at: "2024-01-01T00:00:00.000Z",
            source_query: null,
          },
        ],
      });

      const result = await getVideo("minimal");

      expect(result).toEqual({
        videoId: "minimal",
        title: null,
        link: null,
        channel: null,
        snippet: null,
        duration: null,
        thumbnail: null,
        publishedAt: null,
        scrapedAt: "2024-01-01T00:00:00.000Z",
        sourceQuery: null,
      });
    });
  });
});
