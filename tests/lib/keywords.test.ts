import { describe, expect, it } from "vitest";

import { extractKeywordsFromText } from "../../src/lib/keywords";

describe("extractKeywordsFromText", () => {
  it("removes urls and @mentions, normalizes #hashtags, and dedupes", () => {
    const keywords = extractKeywordsFromText(
      "Check https://example.com @someone #Starship Starship launch 2024!!!",
      { max: 20 },
    );

    expect(keywords).toContain("starship");
    expect(keywords).toContain("launch");
    expect(keywords).toContain("2024");
    expect(keywords.join(" ")).not.toMatch(/https?:/);
    expect(keywords.join(" ")).not.toContain("someone");

    // dedupe
    expect(keywords.filter((k) => k === "starship").length).toBe(1);
  });

  it("filters stop words and short tokens", () => {
    const keywords = extractKeywordsFromText("the an is to of in", { max: 20 });
    expect(keywords).toEqual([]);
  });
});
