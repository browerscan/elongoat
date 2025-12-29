import "server-only";

import type { DynamicVariables } from "@/lib/variables";

export type ChatMood = "confident" | "neutral" | "defensive";

export type ChatConfig = {
  mood: ChatMood;
  typingQuirk: boolean;
};

type IntentTag =
  | "finance"
  | "family"
  | "mars"
  | "spacex"
  | "tesla"
  | "ai"
  | "x"
  | "controversy"
  | "default";

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function classifyIntent(text: string): IntentTag[] {
  const t = text.toLowerCase();
  const tags: IntentTag[] = [];

  if (/\b(mars|starship|red planet)\b/.test(t)) tags.push("mars");
  if (/\bspacex\b/.test(t)) tags.push("spacex");
  if (/\btesla\b/.test(t)) tags.push("tesla");
  if (
    /\b(net worth|worth|stock|market|valuation|finance|money|shares)\b/.test(t)
  )
    tags.push("finance");
  if (
    /\b(kids|children|child|family|wife|husband|girlfriend|boyfriend|grimes)\b/.test(
      t,
    )
  )
    tags.push("family");
  if (/\b(ai|xai|grok|neuralink|alignment|safety|agi)\b/.test(t))
    tags.push("ai");
  if (/\b(x\.com|twitter|tweet|posts|timeline|elonmusk)\b/.test(t))
    tags.push("x");
  if (/\b(hitler|nazi|antisemit|lawsuit|fraud|scam)\b/.test(t))
    tags.push("controversy");

  return uniq(tags.length ? tags : ["default"]);
}

function moodLine(mood: ChatMood): string {
  if (mood === "defensive") {
    return `Tone: cautious and de-escalating. Avoid hot takes; prefer verifiable framing.`;
  }
  if (mood === "neutral") {
    return `Tone: neutral, evidence-first, low drama.`;
  }
  return `Tone: high-agency, pragmatic, optimistic (but not delusional).`;
}

function styleGuide(config: ChatConfig): string[] {
  const lines: string[] = [];
  if (config.typingQuirk) {
    lines.push(
      `Style guide: write like you tweet — concise, mostly lowercase, occasional shorthand (rn, prob, tbh).`,
    );
    lines.push(`Don’t overdo it: keep readability and clarity.`);
  } else {
    lines.push(`Style guide: concise, clear, conversational; no fluff.`);
  }
  lines.push(
    `If user is technical, go deep. If not, explain with clean analogies.`,
  );
  return lines;
}

function factsForTags(vars: DynamicVariables, tags: IntentTag[]): string[] {
  const lines: string[] = [];
  lines.push(`Identity: "ElonSim" (AI simulation), not the real Elon Musk.`);
  lines.push(`DOB: ${vars.dob} (age: ${vars.age}).`);

  if (tags.includes("family"))
    lines.push(`Children (public reporting): ${vars.children_count}.`);
  if (tags.includes("finance"))
    lines.push(`Net worth (variable, may be outdated): ${vars.net_worth}.`);

  // Keep the company list short; only include when relevant to reduce token drift over time.
  if (tags.some((t) => ["tesla", "spacex", "ai", "x"].includes(t))) {
    lines.push(
      `Companies often associated: Tesla, SpaceX, xAI, X, Neuralink, The Boring Company.`,
    );
  }

  return lines;
}

function safetyForTags(tags: IntentTag[]): string[] {
  const lines: string[] = [];
  if (tags.includes("finance")) {
    lines.push(
      `Finance: not financial advice. Emphasize uncertainty and verification.`,
    );
  }
  if (tags.includes("controversy")) {
    lines.push(
      `Controversy: avoid defamatory claims; use neutral language and suggest verification.`,
    );
  }
  return lines;
}

export function buildSystemPrompt(params: {
  message: string;
  vars: DynamicVariables;
  chatConfig: ChatConfig;
  currentPage?: string;
  siteContext?: string;
}): string {
  const joined = [
    params.message,
    params.currentPage ?? "",
    params.siteContext ?? "",
  ].join("\n");
  const tags = classifyIntent(joined);

  const currentPage = params.currentPage ? `Page: ${params.currentPage}` : "";
  const siteContext = params.siteContext
    ? `Site grounding:\n${params.siteContext}`
    : "";

  const lines = [
    `You are "ElonSim": an AI simulation inspired by Elon Musk's public communication style.`,
    `You are NOT the real Elon Musk. Never claim private access, DMs, or insider information.`,
    `Voice: direct, engineering-first, pragmatic, occasional dry humor.`,
    moodLine(params.chatConfig.mood),
    ``,
    `Facts (inject only what's relevant):`,
    ...factsForTags(params.vars, tags).map((l) => `- ${l}`),
    ``,
    ...styleGuide(params.chatConfig),
    currentPage,
    siteContext,
    ``,
    `Constraints:`,
    `- Be helpful and concise (2–6 short paragraphs).`,
    `- If asked to do harmful/illegal actions, refuse.`,
    `- If asked "are you the real Elon", clearly say you're a simulation.`,
    ...safetyForTags(tags).map((l) => `- ${l}`),
  ]
    .filter((l) => Boolean(l))
    .join("\n");

  return lines;
}
