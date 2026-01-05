export function extractKeywordsFromText(
  text: string,
  options: { max?: number } = {},
): string[] {
  const max = Math.max(1, Math.min(30, options.max ?? 12));

  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[a-z0-9_]{1,20}/g, " ")
    .replace(/#[a-z0-9_]{1,64}/g, (m) => ` ${m.slice(1)} `)
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "to",
    "of",
    "and",
    "or",
    "in",
    "on",
    "at",
    "for",
    "from",
    "with",
    "by",
    "as",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "we",
    "they",
    "he",
    "she",
    "them",
    "his",
    "her",
    "our",
    "your",
    "my",
    "me",
    "us",
    "not",
    "no",
    "yes",
    "but",
    "so",
    "if",
    "then",
    "than",
    "just",
    "very",
    "can",
    "could",
    "should",
    "would",
    "will",
    "wont",
    "dont",
    "doesnt",
    "didnt",
    "im",
    "ive",
    "youre",
    "youve",
    "theres",
    "thats",
    "what",
    "who",
    "why",
    "how",
    "when",
    "where",
    "about",
    "into",
    "over",
    "under",
    "more",
    "most",
    "some",
    "any",
    "all",
    "each",
    "other",
    "also",
  ]);

  const out: string[] = [];
  const seen = new Set<string>();

  for (const token of cleaned.split(" ")) {
    const word = token.trim();
    if (word.length < 3) continue;
    if (stopWords.has(word)) continue;
    if (/^\d+$/.test(word)) {
      const asNumber = Number.parseInt(word, 10);
      const isYear = word.length === 4 && asNumber >= 1900 && asNumber <= 2100;
      if (!isYear) continue;
    }
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= max) break;
  }

  return out;
}
