export type TopicCategory =
  | "spacex"
  | "tesla"
  | "mars"
  | "ai"
  | "x"
  | "finance"
  | "family"
  | "doge"
  | "general";

export const FOLLOW_UPS: Record<TopicCategory, string[]> = {
  spacex: [
    "When will Starship launch next?",
    "What's the Mars timeline?",
    "How many Starlink satellites?",
    "Is Starship reusable?",
  ],
  tesla: [
    "What's Tesla's FSD status?",
    "New Tesla model plans?",
    "Tesla stock outlook?",
    "How many Giga factories?",
  ],
  mars: [
    "When will humans land on Mars?",
    "How will Mars be terraformed?",
    "Starship fuel production on Mars?",
    "Why Mars instead of the Moon?",
  ],
  ai: [
    "What's xAI's Grok capable of?",
    "When will AGI happen?",
    "Tesla's role in AI?",
    "AI safety concerns?",
  ],
  x: [
    "X's subscription revenue?",
    "What happened to Twitter?",
    "X's future plans?",
    "How's X doing financially?",
  ],
  finance: [
    "Elon's current net worth?",
    "Biggest holdings breakdown?",
    "PayPal vs today's wealth?",
    "Compensation package explained?",
  ],
  family: [
    "How many kids does Elon have?",
    "Who is Elon's current partner?",
    "Family relationship with work?",
    "Kids' education approach?",
  ],
  doge: [
    "Why does Elon support Doge?",
    "Doge to the moon?",
    "Elon's crypto holdings?",
    "Payment plans for Doge?",
  ],
  general: [
    "What's Elon's daily routine?",
    "How does Elon manage time?",
    "Elon's reading recommendations?",
    "Best Elon interview?",
  ],
};

export function detectTopic(text: string): TopicCategory {
  const lower = text.toLowerCase();
  if (/\b(starship|starlink|falcon|rocket|launch|spacex)\b/.test(lower))
    return "spacex";
  if (/\b(mars|red planet|coloniz|terraform)\b/.test(lower)) return "mars";
  if (/\b(tesla|cybertruck|model [sy3x]|giga|ev|fsd|autopilot)\b/.test(lower))
    return "tesla";
  if (/\b(xai|grok|ai|neuralink|agi|intelligence)\b/.test(lower)) return "ai";
  if (/\b(x\.com|twitter|tweet|posts|blue bird)\b/.test(lower)) return "x";
  if (
    /\b(worth|billion|stock|shares|wealth|money|fortune|paypal)\b/.test(lower)
  )
    return "finance";
  if (
    /\b(kids?|children|child|family|wife|partner|grimes|shivon|justine)\b/.test(
      lower,
    )
  )
    return "family";
  if (/\b(doge|dogecoin|crypto|bitcoin|memecoin)\b/.test(lower)) return "doge";
  return "general";
}

export function getFollowUpQuestions(lastUserMessage: string): string[] {
  const fromTopic = detectTopic(lastUserMessage);

  // Shuffle and pick 3-4 questions
  const questions = [...FOLLOW_UPS[fromTopic]];
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return questions.slice(0, 4);
}
