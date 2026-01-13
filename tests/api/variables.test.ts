import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../src/app/api/variables/route";

// Mock dependencies
vi.mock("../../src/lib/variables", () => ({
  getDynamicVariables: vi.fn(),
}));

vi.mock("../../src/lib/rateLimit", () => ({
  rateLimitApi: vi.fn(),
  rateLimitResponse: vi.fn(),
}));

import { getDynamicVariables } from "../../src/lib/variables";
import { rateLimitApi } from "../../src/lib/rateLimit";

describe("API /variables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 200 OK response", async () => {
    vi.mocked(getDynamicVariables).mockResolvedValue({
      age: 54,
      children_count: 14,
      net_worth: "$400B",
      dob: "1971-06-28",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    vi.mocked(rateLimitApi).mockResolvedValue({
      result: { ok: true, remaining: 99, resetSeconds: 60, limit: 100 },
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "60",
      },
    });

    const response = await GET(
      new Request("https://example.com/api/variables"),
    );
    expect(response.status).toBe(200);
  });

  it("returns JSON body with variables", async () => {
    const mockVars = {
      age: 54,
      children_count: 14,
      net_worth: "$400B",
      dob: "1971-06-28",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    vi.mocked(getDynamicVariables).mockResolvedValue(mockVars);

    vi.mocked(rateLimitApi).mockResolvedValue({
      result: { ok: true, remaining: 99, resetSeconds: 60, limit: 100 },
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "60",
      },
    });

    const response = await GET(
      new Request("https://example.com/api/variables"),
    );
    const body = await response.json();

    expect(body).toEqual({
      variables: mockVars,
      updatedAt: mockVars.updatedAt,
    });
  });

  it("includes all dynamic variables in response", async () => {
    vi.mocked(getDynamicVariables).mockResolvedValue({
      age: 54,
      children_count: 14,
      net_worth: "Varies with markets",
      dob: "1971-06-28",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    vi.mocked(rateLimitApi).mockResolvedValue({
      result: { ok: true, remaining: 99, resetSeconds: 60, limit: 100 },
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "60",
      },
    });

    const response = await GET(
      new Request("https://example.com/api/variables"),
    );
    const body = await response.json();

    expect(body.variables).toHaveProperty("age", 54);
    expect(body.variables).toHaveProperty("children_count", 14);
    expect(body.variables).toHaveProperty("net_worth");
    expect(body.variables).toHaveProperty("dob", "1971-06-28");
    expect(body.variables).toHaveProperty("updatedAt");
  });

  it("sets Cache-Control header with public and s-maxage", async () => {
    vi.mocked(getDynamicVariables).mockResolvedValue({
      age: 54,
      children_count: 14,
      net_worth: "$400B",
      dob: "1971-06-28",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    vi.mocked(rateLimitApi).mockResolvedValue({
      result: { ok: true, remaining: 99, resetSeconds: 60, limit: 100 },
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "60",
      },
    });

    const response = await GET(
      new Request("https://example.com/api/variables"),
    );

    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("max-age=0");
    expect(cacheControl).toContain("s-maxage=3600");
    expect(cacheControl).toContain("stale-while-revalidate=86400");
  });

  it("forwards updatedAt from variables", async () => {
    const updatedAt = "2025-12-25T12:00:00.000Z";
    vi.mocked(getDynamicVariables).mockResolvedValue({
      age: 54,
      children_count: 14,
      net_worth: "$400B",
      dob: "1971-06-28",
      updatedAt,
    });

    vi.mocked(rateLimitApi).mockResolvedValue({
      result: { ok: true, remaining: 99, resetSeconds: 60, limit: 100 },
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "60",
      },
    });

    const response = await GET(
      new Request("https://example.com/api/variables"),
    );
    const body = await response.json();

    expect(body.updatedAt).toBe(updatedAt);
  });
});
