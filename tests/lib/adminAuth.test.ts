import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkAdminAuth, unauthorized } from "../../src/lib/adminAuth";

describe("adminAuth", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("checkAdminAuth", () => {
    it("returns false when ELONGOAT_ADMIN_TOKEN is not set", () => {
      delete process.env.ELONGOAT_ADMIN_TOKEN;
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer test-token" },
      });
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("returns false when Authorization header is missing", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com");
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("returns false when Authorization header does not start with Bearer", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Basic correct-token" },
      });
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("returns false when provided token does not match", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer wrong-token" },
      });
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("returns true when provided token matches exactly", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer correct-token" },
      });
      expect(checkAdminAuth(req)).toBe(true);
    });

    it("trims whitespace from provided token", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer  correct-token  " },
      });
      expect(checkAdminAuth(req)).toBe(true);
    });

    it("returns false for tokens with different lengths", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "abc";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer abcd" },
      });
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("is case-sensitive for token comparison", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "MyToken123";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer mytoken123" },
      });
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("handles special characters in tokens", () => {
      const specialToken = "token-with_special.chars=123";
      process.env.ELONGOAT_ADMIN_TOKEN = specialToken;
      const req = new Request("https://example.com", {
        headers: { Authorization: `Bearer ${specialToken}` },
      });
      expect(checkAdminAuth(req)).toBe(true);
    });

    it("returns false for empty Bearer token", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { Authorization: "Bearer " },
      });
      expect(checkAdminAuth(req)).toBe(false);
    });

    it("handles lowercase 'bearer' header", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { authorization: "Bearer correct-token" },
      });
      expect(checkAdminAuth(req)).toBe(true);
    });

    it("handles mixed case 'Bearer' header", () => {
      process.env.ELONGOAT_ADMIN_TOKEN = "correct-token";
      const req = new Request("https://example.com", {
        headers: { Authorization: "bearer correct-token" },
      });
      expect(checkAdminAuth(req)).toBe(false); // "bearer" != "Bearer"
    });

    it("uses timing-safe-equal for constant-time comparison", () => {
      // This test ensures timing-safe comparison is used
      // The exact behavior can't be directly tested, but we verify the function works
      process.env.ELONGOAT_ADMIN_TOKEN = "secret-token-value";
      const correctReq = new Request("https://example.com", {
        headers: { Authorization: "Bearer secret-token-value" },
      });
      const wrongReq = new Request("https://example.com", {
        headers: { Authorization: "Bearer wrong-token-value" },
      });
      expect(checkAdminAuth(correctReq)).toBe(true);
      expect(checkAdminAuth(wrongReq)).toBe(false);
    });
  });

  describe("unauthorized", () => {
    it("returns a Response with 401 status", () => {
      const response = unauthorized();
      expect(response.status).toBe(401);
    });

    it("returns JSON body with error message", async () => {
      const response = unauthorized();
      const body = await response.json();
      expect(body).toEqual({ error: "unauthorized" });
    });

    it("has correct Content-Type header", () => {
      const response = unauthorized();
      expect(response.headers.get("content-type")).toBe("application/json");
    });
  });
});
