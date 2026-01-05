import { describe, expect, it } from "vitest";

import {
  getRecommendations,
  resolveRecommendationQuery,
} from "../../src/lib/recommendations";

describe("resolveRecommendationQuery", () => {
  it("accepts raw q", async () => {
    const resolved = await resolveRecommendationQuery({
      q: "  Starship launch 2024  ",
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.query).toBe("Starship launch 2024");
    expect(resolved?.keywords).toContain("starship");
    expect(resolved?.keywords).toContain("launch");
    expect(resolved?.keywords).toContain("2024");
  });

  it("builds a query from a known PAA slug", async () => {
    const resolved = await resolveRecommendationQuery({
      slug: "what-car-does-elon-musk-drive",
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.query.toLowerCase()).toContain("what car does elon musk");
  });

  it("builds a query from a known cluster page slug", async () => {
    const resolved = await resolveRecommendationQuery({
      slug: "tesla-stock/tesla-stock-news",
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.query.toLowerCase()).toContain("tesla stock");
  });
});

describe("getRecommendations", () => {
  it("does not throw without a database", async () => {
    delete process.env.DATABASE_URL;

    const res = await getRecommendations({
      query: "Tesla",
      limitArticles: 5,
      limitTweets: 5,
      minLikes: 0,
    });

    expect(res.query).toBe("Tesla");
    expect(Array.isArray(res.articles)).toBe(true);
    expect(Array.isArray(res.tweets)).toBe(true);
  });
});
