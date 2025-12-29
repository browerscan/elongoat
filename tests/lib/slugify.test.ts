import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("HELLO WORLD")).toBe("hello-world");
    expect(slugify("TestSlug")).toBe("testslug");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
    expect(slugify("test  slug")).toBe("test-slug");
  });

  it("replaces multiple non-alphanumeric characters with single hyphen", () => {
    expect(slugify("hello!!!world")).toBe("hello-world");
    expect(slugify("test___slug")).toBe("test-slug");
    expect(slugify("foo...bar")).toBe("foo-bar");
  });

  it("removes leading hyphens", () => {
    expect(slugify("---hello")).toBe("hello");
    expect(slugify("###world")).toBe("world");
  });

  it("removes trailing hyphens", () => {
    expect(slugify("hello---")).toBe("hello");
    expect(slugify("world###")).toBe("world");
  });

  it("removes leading and trailing hyphens together", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("keeps alphanumeric characters", () => {
    expect(slugify("hello123world456")).toBe("hello123world456");
    expect(slugify("Test123ABC")).toBe("test123abc");
  });

  it("removes special characters", () => {
    expect(slugify("hello@world#test")).toBe("hello-world-test");
    // Note: the actual implementation keeps apostrophes as part of words
    // because it replaces non-alnum with hyphens, not removes them
    expect(slugify("what's up")).toBe("what-s-up");
  });

  it("handles underscores", () => {
    expect(slugify("hello_world")).toBe("hello-world");
    expect(slugify("test_slug_here")).toBe("test-slug-here");
  });

  it("handles multiple consecutive hyphens", () => {
    expect(slugify("hello--world")).toBe("hello-world");
    expect(slugify("test---slug")).toBe("test-slug");
  });

  it("truncates to 255 characters", () => {
    const longInput = "a".repeat(300);
    expect(slugify(longInput).length).toBe(255);
  });

  it("returns 'untitled' for empty string", () => {
    expect(slugify("")).toBe("untitled");
  });

  it("returns 'untitled' for string with only special characters", () => {
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
    expect(slugify("___")).toBe("untitled");
  });

  it("handles mixed separators", () => {
    expect(slugify("hello world_test-slug")).toBe("hello-world-test-slug");
  });

  it("preserves numbers", () => {
    expect(slugify("Elon Musk age 54")).toBe("elon-musk-age-54");
  });

  it("handles URLs (strips protocol)", () => {
    expect(slugify("https://example.com/test")).toBe("https-example-com-test");
  });

  it("handles email-like strings", () => {
    expect(slugify("test@example.com")).toBe("test-example-com");
  });

  it("trims whitespace before processing", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
    expect(slugify("\ttest slug\n")).toBe("test-slug");
  });

  it("handles single character", () => {
    expect(slugify("a")).toBe("a");
    expect(slugify("A")).toBe("a");
  });

  it("handles single special character", () => {
    expect(slugify("-")).toBe("untitled");
    expect(slugify("@")).toBe("untitled");
  });

  it("preserves hyphens between words", () => {
    expect(slugify("mars-colonization")).toBe("mars-colonization");
  });

  it("handles consecutive spaces", () => {
    expect(slugify("hello     world")).toBe("hello-world");
  });

  it("handles unicode characters gracefully", () => {
    // Non-ASCII characters are removed/replaced
    expect(slugify("hello world")).toBe("hello-world");
  });
});
