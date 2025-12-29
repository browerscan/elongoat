export type ChatUx = {
  initialAssistantMessage: string;
  nudgeTitle: string;
  nudgeBody: string;
  buttonTagline: string;
  inputPlaceholder: string;
  loadingLabel: string;
  quickStart: string[];
};

type ChatTopic =
  | "mars"
  | "spacex"
  | "tesla"
  | "finance"
  | "family"
  | "ai"
  | "x"
  | "video"
  | "default";

function normalizePathname(pathname: string): string {
  const clean = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (!clean.startsWith("/")) return `/${clean}`;
  return clean;
}

function matchTopicFromPathname(pathname: string): ChatTopic {
  const p = normalizePathname(pathname).toLowerCase();

  if (p.startsWith("/videos/")) return "video";
  if (p === "/videos") return "video";
  if (p === "/x" || p.startsWith("/x/")) return "x";

  const hay = p.replaceAll("-", " ").replaceAll("_", " ");

  if (/\b(mars|starship|red planet)\b/.test(hay)) return "mars";
  if (/\bspacex\b/.test(hay)) return "spacex";
  if (/\btesla\b/.test(hay)) return "tesla";
  if (
    /\b(net worth|worth|stock|market|valuation|shares|ipo|finance|money)\b/.test(
      hay,
    )
  )
    return "finance";
  if (
    /\b(kids|children|child|family|wife|husband|girlfriend|boyfriend|grimes)\b/.test(
      hay,
    )
  )
    return "family";
  if (/\b(ai|xai|neuralink|grok|alignment|safety|agi)\b/.test(hay)) return "ai";
  return "default";
}

export function shouldGlitchText(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(alignment|ai safety|control problem|simulation|matrix|we live in a simulation)\b/.test(
    t,
  );
}

export function deriveChatUx(pathname: string): ChatUx {
  const topic = matchTopicFromPathname(pathname);

  const baseDisclaimer =
    "i’m **elonsim** — an ai simulation inspired by elon’s public style (not the real person).";

  if (topic === "mars") {
    return {
      initialAssistantMessage:
        "thinking about the red planet? it’s a hard, messy, very worth-it problem.\n\n" +
        baseDisclaimer +
        "\nask about starship, timelines, or the strongest argument for becoming multi-planetary.",
      nudgeTitle: "Ask about Mars",
      nudgeBody:
        "Want the strongest Mars argument in 60 seconds? I’ll keep it crisp.",
      buttonTagline: "Ask Mars • Starship • timelines",
      inputPlaceholder: "Ask about Mars, Starship, rockets…",
      loadingLabel: "Establishing Neuralink connection…",
      quickStart: [
        "What’s the strongest argument for Mars?",
        "What’s the biggest bottleneck for a self-sustaining city on Mars?",
        "Explain Starship’s strategy and why it matters.",
        "If you had to bet on a Mars timeline, what would you say and why?",
        "Give me the non-hype version of “making life multiplanetary.”",
        "What would change your mind about Mars?",
      ],
    };
  }

  if (topic === "finance") {
    return {
      initialAssistantMessage:
        "money is just a database entry. incentives + execution are what compound.\n\n" +
        baseDisclaimer +
        "\nask about tesla stock narratives, net worth, or how markets misunderstand engineering.",
      nudgeTitle: "Ask about Tesla stock / net worth",
      nudgeBody: "Want a fast, engineering-first take (not financial advice)?",
      buttonTagline: "Ask net worth • stock • incentives",
      inputPlaceholder: "Ask about net worth, Tesla stock, markets…",
      loadingLabel: "Downloading from uplink…",
      quickStart: [
        "Explain Tesla’s valuation drivers like I’m technical (not financial advice).",
        "What’s the biggest misconception markets have about Tesla?",
        "How should I think about net worth vs. impact?",
        "What do you optimize in a capital-intensive business?",
        "Explain “the factory is the product.”",
        "Give a quick checklist to sanity-check a bold claim.",
      ],
    };
  }

  if (topic === "family") {
    return {
      initialAssistantMessage:
        "family topics get messy fast — let’s stick to what’s public and be explicit about uncertainty.\n\n" +
        baseDisclaimer +
        "\nask what’s known, what’s rumor, and what actually matters (values, tradeoffs, time).",
      nudgeTitle: "Ask about family / kids",
      nudgeBody: "I can summarize what’s publicly known and what’s uncertain.",
      buttonTagline: "Ask kids • relationships • rumors",
      inputPlaceholder: "Ask about family, kids, relationships…",
      loadingLabel: "Establishing private channel…",
      quickStart: [
        "What is publicly known here vs. rumor?",
        "How many kids does Elon have (public reporting) and what’s uncertain?",
        "What’s the most charitable interpretation of this situation?",
        "What’s the strongest criticism and the strongest defense?",
        "How should public figures handle privacy boundaries?",
        "Summarize the timeline at a high level (no speculation).",
      ],
    };
  }

  if (topic === "tesla") {
    return {
      initialAssistantMessage:
        "tesla is an engineering + manufacturing problem disguised as a car company.\n\n" +
        baseDisclaimer +
        "\nask about autonomy, batteries, factories, or why iteration speed wins.",
      nudgeTitle: "Ask about Tesla",
      nudgeBody: "Want a systems-engineering explanation instead of PR?",
      buttonTagline: "Ask Tesla • batteries • autonomy",
      inputPlaceholder: "Ask about Tesla, autonomy, batteries…",
      loadingLabel: "Booting autopilot stack…",
      quickStart: [
        "Explain Tesla’s strategy like I’m technical.",
        "Why is manufacturing so hard to scale?",
        "What’s your take on autonomy timelines (with uncertainty)?",
        "Explain batteries: what actually matters (chemistry, cost, scaling).",
        "What does “iterate fast” mean in hardware?",
        "What would you optimize in a factory this week?",
      ],
    };
  }

  if (topic === "spacex") {
    return {
      initialAssistantMessage:
        "space is brutal. physics doesn’t negotiate.\n\n" +
        baseDisclaimer +
        "\nask about reusable rockets, launch economics, or why reliability beats vibes.",
      nudgeTitle: "Ask about SpaceX",
      nudgeBody: "I can explain the economics + engineering tradeoffs fast.",
      buttonTagline: "Ask SpaceX • rockets • reliability",
      inputPlaceholder: "Ask about SpaceX, rockets, launches…",
      loadingLabel: "Linking to Mars uplink…",
      quickStart: [
        "Why is reusability such a big deal economically?",
        "What’s the hardest part of building reliable rockets?",
        "Explain the difference between Starship and Falcon in one minute.",
        "What engineering principle matters most in aerospace?",
        "How do you build a culture that accepts failure but stays safe?",
        "What’s a good mental model for launch cadence?",
      ],
    };
  }

  if (topic === "ai") {
    return {
      initialAssistantMessage:
        "ai is either the best tool we’ve built or the biggest risk we’ve created. both can be true.\n\n" +
        baseDisclaimer +
        "\nask about alignment, xai, neuralink, or practical engineering leadership.",
      nudgeTitle: "Ask about AI",
      nudgeBody: "Want the non-hype take on AI progress and safety?",
      buttonTagline: "Ask AI • xAI • Neuralink",
      inputPlaceholder: "Ask about AI, xAI, Neuralink…",
      loadingLabel: "Synchronizing cognition stack…",
      quickStart: [
        "Give me a sober take on AI risks and what to do about them.",
        "What does “alignment” mean in practical terms?",
        "What’s your view on open vs. closed models?",
        "How would you run an engineering org building AI systems?",
        "What do you think people misunderstand about Neuralink?",
        "Explain AI scaling laws at a high level.",
      ],
    };
  }

  if (topic === "x") {
    return {
      initialAssistantMessage:
        "want a fast read of the latest posts and themes? i can summarize and give context.\n\n" +
        baseDisclaimer +
        "\nask: “summarize the last 10 posts”, “what changed recently”, or “what’s the subtext”.",
      nudgeTitle: "Ask about the latest posts",
      nudgeBody: "I can summarize recent posts and infer the main themes.",
      buttonTagline: "Ask posts • themes • context",
      inputPlaceholder: "Ask about recent posts, themes, context…",
      loadingLabel: "Syncing X feed…",
      quickStart: [
        "Summarize the last ~10 posts and infer the main themes.",
        "Pick the most important recent post and explain why it matters.",
        "What are the recurring narratives right now?",
        "Which claims need verification and how would you verify them?",
        "Give the charitable read and the critical read.",
        "Turn this into 5 bullet takeaways.",
      ],
    };
  }

  if (topic === "video") {
    return {
      initialAssistantMessage:
        "want a fast summary + the key claims from this video?\n\n" +
        baseDisclaimer +
        "\nif transcripts are ingested, i can ground to them. otherwise i’ll stay high-level.",
      nudgeTitle: "Ask about this video",
      nudgeBody: "I can summarize and extract the key claims in seconds.",
      buttonTagline: "Ask this video • claims • summary",
      inputPlaceholder: "Ask about this video, key claims, summary…",
      loadingLabel: "Buffering transcript stream…",
      quickStart: [
        "Summarize this video in 8 bullets.",
        "What are the key claims and what’s uncertain?",
        "Extract the 5 most important quotes (paraphrase).",
        "What would you verify with primary sources?",
        "What’s the strongest counterargument?",
        "Turn this into an executive brief.",
      ],
    };
  }

  return {
    initialAssistantMessage:
      "hi — want a fast answer? i stream responses and can ground to this site.\n\n" +
      baseDisclaimer +
      "\nask about mars, tesla, spacex, ai, or leadership tradeoffs.",
    nudgeTitle: "Ask ElonSim",
    nudgeBody:
      "Want a fast answer? I stream responses and can ground to this site.",
    buttonTagline: "Ask Mars • Tesla • SpaceX",
    inputPlaceholder: "Ask about Mars, Tesla, SpaceX…",
    loadingLabel: "Establishing Neuralink connection…",
    quickStart: [
      "Give me Elon’s core worldview in 60 seconds.",
      "What’s the strongest argument for Mars?",
      "Explain Tesla’s strategy like I’m technical.",
      "How would you run an engineering org?",
      "Summarize Elon’s companies and focus areas.",
      "What would you optimize in a startup this week?",
    ],
  };
}
