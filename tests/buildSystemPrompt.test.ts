import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "../src/lib/buildSystemPrompt";

const baseVars = {
  age: 54,
  children_count: 14,
  net_worth: "$400B (example)",
  dob: "1971-06-28",
  updatedAt: new Date().toISOString(),
};

describe("buildSystemPrompt", () => {
  it("injects finance facts only when relevant", () => {
    const prompt = buildSystemPrompt({
      message: "what is elon's net worth rn?",
      vars: baseVars,
      chatConfig: { mood: "confident", typingQuirk: true },
      currentPage: "/q/is-elon-musk-a-trillionaire",
      siteContext: "",
    });

    expect(prompt).toContain("Net worth");
    expect(prompt).not.toContain("Children (public reporting)");
  });

  it("injects family facts only when relevant", () => {
    const prompt = buildSystemPrompt({
      message: "how many kids does elon have?",
      vars: baseVars,
      chatConfig: { mood: "confident", typingQuirk: true },
      currentPage: "/q/how-many-kids-does-elon-musk-have",
      siteContext: "",
    });

    expect(prompt).toContain("Children (public reporting)");
    expect(prompt).not.toContain("Net worth");
  });

  it("switches style guide when typingQuirk is disabled", () => {
    const prompt = buildSystemPrompt({
      message: "explain mars",
      vars: baseVars,
      chatConfig: { mood: "neutral", typingQuirk: false },
      currentPage: "/elon-musk-mars/why-mars",
      siteContext: "",
    });

    expect(prompt).toContain(
      "Style guide: concise, clear, conversational; no fluff.",
    );
    expect(prompt).toContain("Tone: neutral");
  });
});
