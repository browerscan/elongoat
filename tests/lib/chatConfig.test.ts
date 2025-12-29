import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getChatConfig } from "@/lib/chatConfig";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(),
}));

const mockDbQuery = vi.fn();
const mockDbPool = {
  query: mockDbQuery,
};

const mockRedisConnect = vi.fn();
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedis = {
  connect: mockRedisConnect,
  get: mockRedisGet,
  set: mockRedisSet,
};

import { getDbPool } from "@/lib/db";
import { getRedis } from "@/lib/redis";

describe("chatConfig", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    originalEnv = { ...process.env };
    mockDbQuery.mockReset();
    mockRedisConnect.mockReset();
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const defaultConfig = {
    config: { mood: "confident" as const, typingQuirk: true },
    updatedAt: expect.any(String),
  };

  describe("getChatConfig", () => {
    it("returns default config when no sources available", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await getChatConfig();

      expect(result).toEqual(defaultConfig);
    });

    it("uses CHAT_MOOD from environment", async () => {
      delete process.env.CHAT_MOOD;
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(null);

      process.env.CHAT_MOOD = "defensive";
      const result = await getChatConfig();
      expect(result.config.mood).toBe("defensive");

      process.env.CHAT_MOOD = "neutral";
      const result2 = await getChatConfig();
      expect(result2.config.mood).toBe("neutral");

      delete process.env.CHAT_MOOD;
    });

    it("uses CHAT_TYPING_QUIRK from environment", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(null);

      process.env.CHAT_TYPING_QUIRK = "false";
      const result = await getChatConfig();
      expect(result.config.typingQuirk).toBe(false);

      process.env.CHAT_TYPING_QUIRK = "true";
      const result2 = await getChatConfig();
      expect(result2.config.typingQuirk).toBe(true);

      delete process.env.CHAT_TYPING_QUIRK;
    });

    it("defaults to confident mood when env var is invalid", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(null);

      process.env.CHAT_MOOD = "invalid-mood";
      const result = await getChatConfig();
      expect(result.config.mood).toBe("confident");

      delete process.env.CHAT_MOOD;
    });

    it("returns cached config from Redis", async () => {
      const cached = {
        config: { mood: "neutral" as const, typingQuirk: false },
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      vi.mocked(getRedis).mockReturnValue(mockRedis as never);
      mockRedisGet.mockResolvedValue(JSON.stringify(cached));

      const result = await getChatConfig();

      expect(result).toEqual(cached);
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it("falls back to DB when Redis is not available", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getChatConfig();

      expect(result.config.mood).toBe("confident");
      expect(result.config.typingQuirk).toBe(true);
    });

    it("reads chat_mood from database", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            key: "chat_mood",
            value: "defensive",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await getChatConfig();

      expect(result.config.mood).toBe("defensive");
    });

    it("reads chat_typing_quirk from database", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            key: "chat_typing_quirk",
            value: "0",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await getChatConfig();

      expect(result.config.typingQuirk).toBe(false);
    });

    it("prefers database values over environment defaults", async () => {
      process.env.CHAT_MOOD = "neutral";
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            key: "chat_mood",
            value: "defensive",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await getChatConfig();

      expect(result.config.mood).toBe("defensive");

      delete process.env.CHAT_MOOD;
    });

    it("handles multiple database variables", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            key: "chat_mood",
            value: "neutral",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
          {
            key: "chat_typing_quirk",
            value: "1",
            updated_at: "2025-01-02T00:00:00.000Z",
          },
        ],
      });

      const result = await getChatConfig();

      expect(result.config.mood).toBe("neutral");
      expect(result.config.typingQuirk).toBe(true);
    });

    it("sets updatedAt to latest database update time", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            key: "chat_mood",
            value: "neutral",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
          {
            key: "chat_typing_quirk",
            value: "1",
            updated_at: "2025-01-02T00:00:00.000Z",
          },
        ],
      });

      const result = await getChatConfig();

      expect(result.updatedAt).toBe("2025-01-02T00:00:00.000Z");
    });

    it("caches result in Redis for 30 seconds", async () => {
      vi.mocked(getRedis).mockReturnValue(mockRedis as never);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await getChatConfig();

      expect(mockRedisSet).toHaveBeenCalledWith(
        "vars:chat-config",
        expect.stringContaining("confident"),
        "EX",
        30,
      );
    });

    it("handles Redis errors gracefully", async () => {
      vi.mocked(getRedis).mockReturnValue(mockRedis as never);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockRedisConnect.mockRejectedValue(new Error("Redis connection failed"));
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getChatConfig();

      expect(result).toEqual(defaultConfig);
    });

    it("handles DB errors gracefully", async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB connection failed"));

      const result = await getChatConfig();

      expect(result.config.mood).toBe("confident");
      expect(result.config.typingQuirk).toBe(true);
    });

    describe("parseBool", () => {
      it("parses various true values", async () => {
        vi.mocked(getRedis).mockReturnValue(null);
        vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);

        const trueValues = ["1", "true", "yes", "y", "on", "TRUE", "Yes"];

        for (const val of trueValues) {
          mockDbQuery.mockResolvedValue({
            rows: [
              {
                key: "chat_typing_quirk",
                value: val,
                updated_at: "2025-01-01T00:00:00.000Z",
              },
            ],
          });
          const result = await getChatConfig();
          expect(result.config.typingQuirk).toBe(true);
        }
      });

      it("parses various false values", async () => {
        vi.mocked(getRedis).mockReturnValue(null);
        vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);

        const falseValues = ["0", "false", "no", "n", "off", "FALSE", "No"];

        for (const val of falseValues) {
          mockDbQuery.mockResolvedValue({
            rows: [
              {
                key: "chat_typing_quirk",
                value: val,
                updated_at: "2025-01-01T00:00:00.000Z",
              },
            ],
          });
          const result = await getChatConfig();
          expect(result.config.typingQuirk).toBe(false);
        }
      });
    });
  });
});
