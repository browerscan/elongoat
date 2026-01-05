/**
 * Security Tests
 *
 * Tests for SQL injection prevention, CSP headers, and circuit breaker TTL cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  escapeLikePattern,
  isValidIdentifier,
  isValidSchemaTable,
} from "../../src/lib/sqlSecurity";

// ============================================================================
// SQL Injection Prevention Tests
// ============================================================================

describe("SQL Injection Prevention - escapeLikePattern", () => {
  it("should escape percent sign", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("%test%")).toBe("\\%test\\%");
  });

  it("should escape underscore", () => {
    expect(escapeLikePattern("test_value")).toBe("test\\_value");
    expect(escapeLikePattern("_prefix")).toBe("\\_prefix");
  });

  it("should escape backslash", () => {
    expect(escapeLikePattern("path\\to\\file")).toBe("path\\\\to\\\\file");
    expect(escapeLikePattern("\\")).toBe("\\\\");
  });

  it("should escape all special characters together", () => {
    expect(escapeLikePattern("100% of_items\\path")).toBe(
      "100\\% of\\_items\\\\path",
    );
  });

  it("should handle empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });

  it("should handle string with no special characters", () => {
    expect(escapeLikePattern("normal text")).toBe("normal text");
  });

  it("should prevent SQL injection via LIKE wildcards", () => {
    // Attacker tries to use % to match everything
    // Note: SQL injection via quotes is prevented by parameterized queries
    // This function only handles LIKE-specific wildcards
    const maliciousInput = "100% of users";
    const escaped = escapeLikePattern(maliciousInput);

    // The % wildcard should be escaped
    expect(escaped).toContain("\\%");
    expect(escaped).toBe("100\\% of users");

    // Verify wildcards are escaped
    expect(escapeLikePattern("_admin")).toBe("\\_admin");
  });

  it("should escape multiple consecutive special chars", () => {
    expect(escapeLikePattern("%%%")).toBe("\\%\\%\\%");
    expect(escapeLikePattern("___")).toBe("\\_\\_\\_");
    expect(escapeLikePattern("\\\\\\")).toBe("\\\\\\\\\\\\");
  });
});

describe("SQL Injection Prevention - isValidIdentifier", () => {
  it("should accept valid identifiers", () => {
    expect(isValidIdentifier("users")).toBe(true);
    expect(isValidIdentifier("user_table")).toBe(true);
    expect(isValidIdentifier("_private")).toBe(true);
    expect(isValidIdentifier("Table123")).toBe(true);
  });

  it("should reject identifiers starting with numbers", () => {
    expect(isValidIdentifier("123table")).toBe(false);
    expect(isValidIdentifier("1")).toBe(false);
  });

  it("should reject identifiers with special characters", () => {
    expect(isValidIdentifier("user-table")).toBe(false);
    expect(isValidIdentifier("user.table")).toBe(false);
    expect(isValidIdentifier("user table")).toBe(false);
    expect(isValidIdentifier("user;DROP")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isValidIdentifier("")).toBe(false);
  });
});

describe("SQL Injection Prevention - isValidSchemaTable", () => {
  it("should accept valid schema.table names", () => {
    expect(isValidSchemaTable("elongoat.content_cache")).toBe(true);
    expect(isValidSchemaTable("public.users")).toBe(true);
    expect(isValidSchemaTable("_private.data")).toBe(true);
  });

  it("should reject names without schema", () => {
    expect(isValidSchemaTable("users")).toBe(false);
    expect(isValidSchemaTable("")).toBe(false);
  });

  it("should reject names with too many parts", () => {
    expect(isValidSchemaTable("db.schema.table")).toBe(false);
  });

  it("should reject invalid schema or table names", () => {
    expect(isValidSchemaTable("123schema.table")).toBe(false);
    expect(isValidSchemaTable("schema.123table")).toBe(false);
    expect(isValidSchemaTable("schema.table-name")).toBe(false);
  });
});

// ============================================================================
// CSP Header Tests
// ============================================================================

describe("Content Security Policy", () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should generate nonce-based CSP when nonce is provided", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://elongoat.io";

    // Dynamic import to get fresh module with new env
    const { getContentSecurityPolicy } =
      await import("../../src/lib/securityHeaders");

    const nonce = "test-nonce-12345";
    const csp = getContentSecurityPolicy(nonce);

    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
    // With nonce, unsafe-inline should NOT be in script-src
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("should use strict-dynamic in production without nonce", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://elongoat.io";

    const { getContentSecurityPolicy } =
      await import("../../src/lib/securityHeaders");

    const csp = getContentSecurityPolicy();

    expect(csp).toContain("'strict-dynamic'");
    // unsafe-inline is kept as fallback for older browsers
    expect(csp).toContain("'unsafe-inline'");
  });

  it("should allow unsafe-eval in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    const { getContentSecurityPolicy } =
      await import("../../src/lib/securityHeaders");

    const csp = getContentSecurityPolicy();

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("'unsafe-inline'");
  });

  it("should include API origin in connect-src", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://elongoat.io";
    process.env.NEXT_PUBLIC_API_URL = "https://api.elongoat.io";

    const { getContentSecurityPolicy } =
      await import("../../src/lib/securityHeaders");

    const csp = getContentSecurityPolicy();

    expect(csp).toContain("https://api.elongoat.io");
  });

  it("should generate valid nonce", async () => {
    const { getNonce } = await import("../../src/lib/securityHeaders");

    const nonce = getNonce();

    // Nonce should be base64 encoded 16 bytes
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{22,24}$/);
    // Each call should generate a different nonce
    expect(getNonce()).not.toBe(nonce);
  });
});

// ============================================================================
// Circuit Breaker TTL Cleanup Tests
// ============================================================================

describe("Circuit Breaker TTL Cleanup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create circuit breakers with last access time", async () => {
    const {
      getCircuitBreaker,
      getAllCircuitBreakerStats,
      resetAllCircuitBreakers,
    } = await import("../../src/lib/circuitBreaker");

    // Clean up any existing breakers
    resetAllCircuitBreakers();

    const breaker = getCircuitBreaker("test-breaker");

    expect(breaker).toBeDefined();
    expect(breaker.getStats().state).toBe("closed");
  });

  it("should update last access time on get", async () => {
    const {
      getCircuitBreaker,
      getCircuitBreakerCount,
      resetAllCircuitBreakers,
    } = await import("../../src/lib/circuitBreaker");

    resetAllCircuitBreakers();

    getCircuitBreaker("test-breaker-1");
    expect(getCircuitBreakerCount()).toBe(1);

    // Access again should not create a new one
    getCircuitBreaker("test-breaker-1");
    expect(getCircuitBreakerCount()).toBe(1);
  });

  it("should expose count function for monitoring", async () => {
    const {
      getCircuitBreaker,
      getCircuitBreakerCount,
      resetAllCircuitBreakers,
    } = await import("../../src/lib/circuitBreaker");

    resetAllCircuitBreakers();

    expect(getCircuitBreakerCount()).toBe(0);

    getCircuitBreaker("breaker-1");
    expect(getCircuitBreakerCount()).toBe(1);

    getCircuitBreaker("breaker-2");
    expect(getCircuitBreakerCount()).toBe(2);
  });

  it("should have stop cleanup interval function", async () => {
    const { stopCleanupInterval } =
      await import("../../src/lib/circuitBreaker");

    // Should not throw
    expect(() => stopCleanupInterval()).not.toThrow();
  });
});

// ============================================================================
// Environment Variable Validation Tests
// ============================================================================

describe("Security Environment Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should report error when ELONGOAT_ADMIN_SESSION_SECRET is missing in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://elongoat.io";
    delete process.env.ELONGOAT_ADMIN_SESSION_SECRET;
    process.env.ELONGOAT_ADMIN_TOKEN =
      "this-is-a-very-long-token-that-is-more-than-32-chars";

    const { validateSecurityConfig } =
      await import("../../src/lib/securityHeaders");

    const result = validateSecurityConfig();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "ELONGOAT_ADMIN_SESSION_SECRET must be set in production",
    );
  });

  it("should report error when ELONGOAT_ADMIN_TOKEN is too short in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://elongoat.io";
    process.env.ELONGOAT_ADMIN_SESSION_SECRET = "secret";
    process.env.ELONGOAT_ADMIN_TOKEN = "short";

    const { validateSecurityConfig } =
      await import("../../src/lib/securityHeaders");

    const result = validateSecurityConfig();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "ELONGOAT_ADMIN_TOKEN must be at least 32 characters in production",
    );
  });

  it("should pass validation with proper production config", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://elongoat.io";
    process.env.ELONGOAT_ADMIN_SESSION_SECRET = "a-very-secure-session-secret";
    process.env.ELONGOAT_ADMIN_TOKEN =
      "this-is-a-very-long-token-that-is-more-than-32-characters-for-sure";

    const { validateSecurityConfig } =
      await import("../../src/lib/securityHeaders");

    const result = validateSecurityConfig();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
