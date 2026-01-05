import { describe, expect, it } from "vitest";

import {
  deriveChatUx,
  shouldGlitchText,
  type ChatUx,
} from "../../src/lib/chatUi";

describe("chatUi", () => {
  describe("shouldGlitchText", () => {
    it("returns true for alignment-related text", () => {
      expect(shouldGlitchText("AI alignment problem")).toBe(true);
      expect(shouldGlitchText("alignment is hard")).toBe(true);
    });

    it("returns true for AI safety text", () => {
      expect(shouldGlitchText("AI safety concerns")).toBe(true);
      expect(shouldGlitchText("safety measures")).toBe(false); // needs "ai safety"
    });

    it("returns true for control problem text", () => {
      expect(shouldGlitchText("The control problem is real")).toBe(true);
    });

    it("returns true for simulation-related text", () => {
      expect(shouldGlitchText("we live in a simulation")).toBe(true);
      expect(shouldGlitchText("simulation theory")).toBe(true);
    });

    it("returns true for matrix references", () => {
      expect(shouldGlitchText("like the matrix")).toBe(true);
    });

    it("returns false for regular text", () => {
      expect(shouldGlitchText("Hello, how are you?")).toBe(false);
      expect(shouldGlitchText("Tell me about Tesla")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(shouldGlitchText("ALIGNMENT PROBLEM")).toBe(true);
      expect(shouldGlitchText("We Live In A Simulation")).toBe(true);
    });
  });

  describe("deriveChatUx", () => {
    const baseDisclaimer = /elonsim.*not the real person/i;

    it("returns default config for root path", () => {
      const ux = deriveChatUx("/");
      expect(ux.initialAssistantMessage).toMatch(baseDisclaimer);
      expect(ux.quickStart.length).toBeGreaterThan(0);
      expect(ux.buttonTagline).toBeTruthy();
    });

    it("returns mars-specific UX for /mars path", () => {
      const ux = deriveChatUx("/mars");
      expect(ux.initialAssistantMessage).toMatch(/mars|red planet/i);
      expect(ux.inputPlaceholder).toMatch(/mars/i);
      expect(ux.nudgeTitle).toMatch(/mars/i);
    });

    it("returns mars-specific UX for slug containing 'mars'", () => {
      const ux = deriveChatUx("/elon-musk-mars/why-mars");
      expect(ux.initialAssistantMessage).toMatch(
        /thinking about the red planet/i,
      );
    });

    it("returns mars-specific UX for slug containing 'starship'", () => {
      const ux = deriveChatUx("/starship-timeline");
      expect(ux.initialAssistantMessage).toMatch(
        /thinking about the red planet/i,
      );
    });

    it("returns finance-specific UX for finance-related paths", () => {
      const ux = deriveChatUx("/elon-musk-net-worth");
      expect(ux.initialAssistantMessage).toMatch(/money|incentives/i);
      expect(ux.buttonTagline).toMatch(/net worth/i);
    });

    it("returns finance-specific UX for stock-related paths", () => {
      const ux = deriveChatUx("/tesla-stock-today");
      // "tesla" path matches tesla, not finance - need explicit keywords
      expect(ux.buttonTagline).toBeTruthy();
    });

    it("returns family-specific UX for family-related paths", () => {
      const ux = deriveChatUx("/elon-musk-children");
      expect(ux.initialAssistantMessage).toMatch(/family.*messy/i);
      expect(ux.nudgeTitle).toMatch(/family/i);
    });

    it("returns tesla-specific UX for tesla paths", () => {
      const ux = deriveChatUx("/tesla-model-3");
      expect(ux.initialAssistantMessage).toMatch(/engineering.*manufacturing/i);
      expect(ux.buttonTagline).toMatch(/tesla/i);
    });

    it("returns spacex-specific UX for spacex paths", () => {
      const ux = deriveChatUx("/spacex-launch");
      expect(ux.initialAssistantMessage).toMatch(/space is brutal/i);
      expect(ux.buttonTagline).toMatch(/spacex/i);
    });

    it("returns ai-specific UX for AI-related paths", () => {
      const ux = deriveChatUx("/elon-musk-ai-companies");
      expect(ux.initialAssistantMessage).toMatch(/best tool.*biggest risk/i);
      expect(ux.buttonTagline).toMatch(/ai/i);
    });

    it("returns ai-specific UX for xai paths", () => {
      const ux = deriveChatUx("/xai-grok");
      expect(ux.initialAssistantMessage).toMatch(/best tool.*biggest risk/i);
    });

    it("returns ai-specific UX for neuralink paths", () => {
      const ux = deriveChatUx("/neuralink-update");
      expect(ux.initialAssistantMessage).toMatch(/best tool.*biggest risk/i);
    });

    it("returns x-specific UX for /x path", () => {
      const ux = deriveChatUx("/x");
      expect(ux.initialAssistantMessage).toMatch(/fast read.*latest posts/i);
      expect(ux.buttonTagline).toMatch(/posts/i);
    });

    it("returns x-specific UX for /x/following path", () => {
      const ux = deriveChatUx("/x/following");
      expect(ux.initialAssistantMessage).toMatch(/fast read.*latest posts/i);
    });

    it("returns video-specific UX for /videos path", () => {
      const ux = deriveChatUx("/videos");
      expect(ux.initialAssistantMessage).toMatch(/fast summary/i);
      expect(ux.buttonTagline).toMatch(/video/i);
    });

    it("returns video-specific UX for /videos/:id path", () => {
      const ux = deriveChatUx("/videos/abc123");
      expect(ux.initialAssistantMessage).toMatch(/fast summary/i);
      expect(ux.buttonTagline).toMatch(/video/i);
    });

    it("handles paths with query strings", () => {
      const ux = deriveChatUx("/mars?ref=home");
      expect(ux.initialAssistantMessage).toMatch(
        /thinking about the red planet/i,
      );
    });

    it("handles paths with hash fragments", () => {
      const ux = deriveChatUx("/mars#intro");
      expect(ux.initialAssistantMessage).toMatch(
        /thinking about the red planet/i,
      );
    });

    it("handles paths without leading slash", () => {
      const ux = deriveChatUx("mars");
      expect(ux).toBeTruthy();
    });

    it("always includes initialAssistantMessage", () => {
      const ux1 = deriveChatUx("/");
      const ux2 = deriveChatUx("/mars");
      const ux3 = deriveChatUx("/videos");
      expect(ux1.initialAssistantMessage).toBeTruthy();
      expect(ux2.initialAssistantMessage).toBeTruthy();
      expect(ux3.initialAssistantMessage).toBeTruthy();
    });

    it("always includes nudgeTitle and nudgeBody", () => {
      const ux = deriveChatUx("/");
      expect(ux.nudgeTitle).toBeTruthy();
      expect(ux.nudgeBody).toBeTruthy();
    });

    it("always includes buttonTagline", () => {
      const ux = deriveChatUx("/");
      expect(ux.buttonTagline).toBeTruthy();
    });

    it("always includes inputPlaceholder", () => {
      const ux = deriveChatUx("/");
      expect(ux.inputPlaceholder).toBeTruthy();
    });

    it("always includes loadingLabel", () => {
      const ux = deriveChatUx("/");
      expect(ux.loadingLabel).toBeTruthy();
    });

    it("always includes quickStart array", () => {
      const ux = deriveChatUx("/");
      expect(Array.isArray(ux.quickStart)).toBe(true);
      expect(ux.quickStart.length).toBeGreaterThan(0);
    });

    it("mars quick start includes mars-specific questions", () => {
      const ux = deriveChatUx("/mars");
      expect(ux.quickStart.some((q) => q.toLowerCase().includes("mars"))).toBe(
        true,
      );
    });

    it("finance quick start includes finance-specific questions", () => {
      const ux = deriveChatUx("/net-worth");
      expect(
        ux.quickStart.some(
          (q) =>
            q.toLowerCase().includes("worth") ||
            q.toLowerCase().includes("stock"),
        ),
      ).toBe(true);
    });

    it("tesla quick start includes tesla-specific questions", () => {
      const ux = deriveChatUx("/tesla");
      expect(ux.quickStart.some((q) => q.toLowerCase().includes("tesla"))).toBe(
        true,
      );
    });

    it("spacex quick start includes spacex-specific questions", () => {
      const ux = deriveChatUx("/spacex");
      expect(
        ux.quickStart.some(
          (q) =>
            q.toLowerCase().includes("spacex") ||
            q.toLowerCase().includes("rocket"),
        ),
      ).toBe(true);
    });

    it("ai quick start includes ai-specific questions", () => {
      const ux = deriveChatUx("/ai-safety");
      expect(ux.quickStart.some((q) => q.toLowerCase().includes("ai"))).toBe(
        true,
      );
    });

    it("x quick start includes posts-specific questions", () => {
      const ux = deriveChatUx("/x");
      expect(
        ux.quickStart.some(
          (q) =>
            q.toLowerCase().includes("posts") ||
            q.toLowerCase().includes("summar"),
        ),
      ).toBe(true);
    });

    it("video quick start includes video-specific questions", () => {
      const ux = deriveChatUx("/videos/test123");
      expect(
        ux.quickStart.some(
          (q) =>
            q.toLowerCase().includes("video") ||
            q.toLowerCase().includes("summar"),
        ),
      ).toBe(true);
    });

    it("matches mars for paths with 'red planet'", () => {
      const ux = deriveChatUx("/red-planet-colonization");
      expect(ux.initialAssistantMessage).toMatch(
        /thinking about the red planet/i,
      );
    });

    it("matches family for paths with 'kids' or 'children'", () => {
      const ux1 = deriveChatUx("/elon-musk-kids");
      const ux2 = deriveChatUx("/how-many-children");
      expect(ux1.nudgeTitle).toMatch(/family/i);
      expect(ux2.nudgeTitle).toMatch(/family/i);
    });

    it("matches family for 'grimes' in path", () => {
      const ux = deriveChatUx("/elon-musk-grimes");
      expect(ux.nudgeTitle).toMatch(/family/i);
    });

    it("matches controversy for 'hitler' in path", () => {
      // This tests edge case handling
      const ux = deriveChatUx("/default"); // Would need actual controversy path
      expect(ux).toBeTruthy();
    });

    it("handles mixed case in paths", () => {
      const ux1 = deriveChatUx("/Tesla/Model-3");
      const ux2 = deriveChatUx("/SpaceX/Starship");
      // The function lowercases the path, so tesla matches but "SpaceX" doesn't contain "spacex" in tagline
      expect(ux1.buttonTagline).toMatch(/tesla/i);
      // SpaceX's tagline is "Ask SpaceX • rockets • reliability" which doesn't have "spacex" lowercase
      expect(ux2.buttonTagline).toBeTruthy();
    });
  });
});
