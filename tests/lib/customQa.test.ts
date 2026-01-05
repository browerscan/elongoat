import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCustomQa,
  listCustomQaSlugs,
  listLatestCustomQas,
  upsertCustomQa,
  generateCustomQa,
} from "../../src/lib/customQa";

// Mock dependencies
vi.mock("../../src/lib/db", () => ({
  getDbPool: vi.fn(),
}));

vi.mock("../../src/lib/variables", () => ({
  getDynamicVariables: vi.fn(),
}));

vi.mock("../../src/lib/slugify", () => ({
  slugify: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
}));

vi.mock("../../src/lib/vectorengine", () => ({
  vectorEngineChatComplete: vi.fn(),
}));

const mockDbQuery = vi.fn();
const mockDbPool = {
  query: mockDbQuery,
};

import { getDbPool } from "../../src/lib/db";
import { getDynamicVariables } from "../../src/lib/variables";
import { slugify } from "../../src/lib/slugify";
import { vectorEngineChatComplete } from "../../src/lib/vectorengine";

describe("customQa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockDbQuery.mockReset();
  });

  const mockCustomQaRow = {
    slug: "test-question",
    question: "Test Question?",
    answer_md: "# Test Answer\n\nThis is a test answer.",
    model: "claude-sonnet-4",
    sources: { kind: "manual" },
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-02T00:00:00.000Z",
  };

  const mockVars = {
    age: 54,
    children_count: 14,
    net_worth: "$400B",
    dob: "1971-06-28",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  describe("getCustomQa", () => {
    it("returns null when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await getCustomQa("test-slug");
      expect(result).toBeNull();
    });

    it("returns null when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await getCustomQa("test-slug");
      expect(result).toBeNull();
    });

    it("returns null when question not found", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      const result = await getCustomQa("nonexistent");
      expect(result).toBeNull();
    });

    it("returns custom Q&A when found", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [mockCustomQaRow] });

      const result = await getCustomQa("test-question");

      expect(result).toEqual({
        slug: "test-question",
        question: "Test Question?",
        answerMd: "# Test Answer\n\nThis is a test answer.",
        model: "claude-sonnet-4",
        sources: { kind: "manual" },
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("queries with slug parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await getCustomQa("test-slug");

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("where slug = $1"),
        ["test-slug"],
      );
    });

    it("handles null sources", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [{ ...mockCustomQaRow, sources: null }],
      });

      const result = await getCustomQa("test-question");

      expect(result?.sources).toBeNull();
    });
  });

  describe("listCustomQaSlugs", () => {
    it("returns empty array when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await listCustomQaSlugs();
      expect(result).toEqual([]);
    });

    it("returns empty array when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await listCustomQaSlugs();
      expect(result).toEqual([]);
    });

    it("uses default limit of 5000", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listCustomQaSlugs();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [5000],
      );
    });

    it("respects custom limit parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listCustomQaSlugs(100);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [100],
      );
    });

    it("clamps limit to maximum of 5000", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listCustomQaSlugs(10000);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [5000],
      );
    });

    it("clamps limit to minimum of 1", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listCustomQaSlugs(0);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [1],
      );
    });

    it("returns array of slugs", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          { slug: "question-1" },
          { slug: "question-2" },
          { slug: "question-3" },
        ],
      });

      const result = await listCustomQaSlugs();

      expect(result).toEqual(["question-1", "question-2", "question-3"]);
    });

    it("orders by created_at desc", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listCustomQaSlugs();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("order by created_at desc"),
        expect.anything(),
      );
    });
  });

  describe("listLatestCustomQas", () => {
    it("returns empty array when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      const result = await listLatestCustomQas();
      expect(result).toEqual([]);
    });

    it("returns empty array when DB query throws", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockRejectedValue(new Error("DB error"));

      const result = await listLatestCustomQas();
      expect(result).toEqual([]);
    });

    it("uses default limit of 12", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listLatestCustomQas();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [12],
      );
    });

    it("respects custom limit parameter", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listLatestCustomQas(25);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [25],
      );
    });

    it("clamps limit to maximum of 50", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rows: [] });

      await listLatestCustomQas(100);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("limit $1"),
        [50],
      );
    });

    it("returns partial Q&A objects (slug, question, model, dates)", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({
        rows: [
          {
            slug: "q1",
            question: "Question 1?",
            model: "claude-sonnet-4",
            created_at: "2024-01-01T00:00:00.000Z",
            updated_at: "2024-01-02T00:00:00.000Z",
          },
        ],
      });

      const result = await listLatestCustomQas();

      expect(result).toEqual([
        {
          slug: "q1",
          question: "Question 1?",
          model: "claude-sonnet-4",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
        },
      ]);
    });
  });

  describe("upsertCustomQa", () => {
    it("throws error when DB is not available", async () => {
      vi.mocked(getDbPool).mockReturnValue(null);

      await expect(
        upsertCustomQa({
          slug: "test",
          question: "Test?",
          answerMd: "# Answer",
          model: "manual",
        }),
      ).rejects.toThrow("DATABASE_URL not configured");
    });

    it("inserts new custom Q&A", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await upsertCustomQa({
        slug: "test-question",
        question: "Test Question?",
        answerMd: "# Test Answer",
        model: "claude-sonnet-4",
        sources: { kind: "manual" },
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("insert into elongoat.custom_qas"),
        expect.arrayContaining([
          "test-question",
          "Test Question?",
          "# Test Answer",
          "claude-sonnet-4",
        ]),
      );
    });

    it("handles upsert conflict (existing slug)", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await upsertCustomQa({
        slug: "existing-question",
        question: "Updated Question?",
        answerMd: "# Updated Answer",
        model: "claude-sonnet-4",
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("on conflict"),
        expect.anything(),
      );
    });

    it("stringifies sources when provided", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      const sources = { url: "https://example.com", kind: "test" };

      await upsertCustomQa({
        slug: "test",
        question: "Test?",
        answerMd: "# Answer",
        model: "manual",
        sources,
      });

      const callArgs = mockDbQuery.mock.calls[0];
      expect(callArgs[1]).toContain(JSON.stringify(sources));
    });

    it("sets sources to null when not provided", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });

      await upsertCustomQa({
        slug: "test",
        question: "Test?",
        answerMd: "# Answer",
        model: "manual",
      });

      const callArgs = mockDbQuery.mock.calls[0];
      expect(callArgs[1]).toContain(null);
    });
  });

  describe("generateCustomQa", () => {
    beforeEach(() => {
      vi.mocked(getDynamicVariables).mockResolvedValue(mockVars);
      process.env.VECTORENGINE_API_KEY = "test-key";
    });

    afterEach(() => {
      delete process.env.VECTORENGINE_API_KEY;
    });

    it("throws when VectorEngine is not configured", async () => {
      delete process.env.VECTORENGINE_API_KEY;

      await expect(
        generateCustomQa({ question: "Test question?" }),
      ).rejects.toThrow("VectorEngine content model not configured");
    });

    it("generates Q&A using VectorEngine", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({
        text: "# Generated Answer\n\nThis is the answer.",
        usage: { totalTokens: 100 },
      });

      const result = await generateCustomQa({
        question: "What is the strongest argument for Mars?",
      });

      expect(vectorEngineChatComplete).toHaveBeenCalledWith({
        model: "claude-sonnet-4-5-20250929",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "What is the strongest argument for Mars?",
            ),
          }),
        ]),
        temperature: 0.4,
        maxTokens: 950,
      });

      // Note: slugify is mocked to lowercase and replace spaces with hyphens
      // The actual slugify includes the question mark at the end
      expect(result.slug).toContain("what-is-the-strongest-argument-for-mars");
      expect(result.answerMd).toContain("Generated Answer");
      expect(result.model).toBe("claude-sonnet-4-5-20250929");
    });

    it("uses provided slug when available", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(slugify).mockReturnValue("custom-slug");
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({
        text: "Answer",
      });

      const result = await generateCustomQa({
        question: "Test question?",
        slug: "custom-slug",
      });

      expect(result.slug).toBe("custom-slug");
    });

    it("uses VECTORENGINE_CONTENT_MODEL from env when set", async () => {
      process.env.VECTORENGINE_CONTENT_MODEL = "custom-model";
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({ text: "Answer" });

      await generateCustomQa({ question: "Test?" });

      expect(vectorEngineChatComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "custom-model",
        }),
      );

      delete process.env.VECTORENGINE_CONTENT_MODEL;
    });

    it("upserts generated Q&A to database", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({
        text: "# Answer",
      });

      await generateCustomQa({ question: "Test question?" });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("insert into elongoat.custom_qas"),
        expect.arrayContaining([
          expect.stringContaining("test-question"),
          "Test question?",
          "# Answer",
        ]),
      );
    });

    it("includes generatedAt timestamp in sources", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({ text: "Answer" });

      await generateCustomQa({ question: "Test?" });

      const callArgs = mockDbQuery.mock.calls[0];
      const sourcesArg = callArgs[1][4]; // sources is 5th parameter
      const sources = JSON.parse(sourcesArg as string);
      expect(sources.kind).toBe("custom_qa");
      expect(sources.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("handles empty VectorEngine response", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({ text: "" });

      const result = await generateCustomQa({ question: "Test?" });

      expect(result.answerMd).toContain("Empty response");
    });

    it("includes variables in system prompt", async () => {
      vi.mocked(getDbPool).mockReturnValue(mockDbPool as never);
      mockDbQuery.mockResolvedValue({ rowCount: 1 });
      vi.mocked(vectorEngineChatComplete).mockResolvedValue({ text: "Answer" });

      await generateCustomQa({ question: "Test?" });

      const callArgs = vi.mocked(vectorEngineChatComplete).mock.calls[0];
      const userMessage = callArgs[0].messages[1].content;

      expect(userMessage).toContain("age=54");
      expect(userMessage).toContain("children_count=14");
      expect(userMessage).toContain("dob=1971-06-28");
    });
  });
});
