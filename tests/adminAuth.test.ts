import { describe, it, expect, beforeEach, vi } from "vitest";
import { timingSafeEqual } from "node:crypto";

// Mock the server-only import
vi.mock("@/lib/redis", () => ({
  getRedis: () => null,
}));

describe("AdminAuth", () => {
  const mockToken = "test_admin_token_at_least_32_characters_long";
  const mockSecret = "test_session_secret_at_least_32_characters_long";

  beforeEach(() => {
    vi.stubEnv("ELONGOAT_ADMIN_TOKEN", mockToken);
    vi.stubEnv("ELONGOAT_ADMIN_SESSION_SECRET", mockSecret);
  });

  describe("timing-safe comparison", () => {
    it("should return true for matching tokens", () => {
      const a = Buffer.from("matching_token", "utf8");
      const b = Buffer.from("matching_token", "utf8");
      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it("should return false for different tokens of same length", () => {
      const a = Buffer.from("token_one", "utf8");
      const b = Buffer.from("token_two", "utf8");
      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it("should throw for tokens of different lengths", () => {
      const a = Buffer.from("short", "utf8");
      const b = Buffer.from("much_longer_token", "utf8");
      // timingSafeEqual throws when lengths differ in newer Node versions
      expect(() => timingSafeEqual(a, b)).toThrow();
    });
  });

  describe("validateSecurityConfig", () => {
    it("should pass with valid configuration", async () => {
      const { validateSecurityConfig } = await import("@/lib/adminAuth");
      const result = validateSecurityConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail when admin token is too short", async () => {
      vi.stubEnv("ELONGOAT_ADMIN_TOKEN", "short");
      const { validateSecurityConfig } = await import("@/lib/adminAuth");
      const result = validateSecurityConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("32"))).toBe(true);
    });

    it("should fail when session secret is missing", async () => {
      vi.stubEnv("ELONGOAT_ADMIN_SESSION_SECRET", "");
      const { validateSecurityConfig } = await import("@/lib/adminAuth");
      const result = validateSecurityConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("SESSION_SECRET"))).toBe(
        true,
      );
    });
  });

  describe("generateSecureToken", () => {
    it("should generate a token of specified length", async () => {
      const { generateSecureToken } = await import("@/lib/adminAuth");
      const token = generateSecureToken(32);
      expect(token).toBeTruthy();
      // base64url encoding means length may vary slightly, just check it's close
      expect(token.length).toBeGreaterThan(30);
    });

    it("should generate different tokens each time", async () => {
      const { generateSecureToken } = await import("@/lib/adminAuth");
      const token1 = generateSecureToken(48);
      const token2 = generateSecureToken(48);
      expect(token1).not.toBe(token2);
    });
  });
});
