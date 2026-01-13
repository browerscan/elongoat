// Content quality analysis module
// Analyzes generated content for SEO, readability, and structure

// ============================================================================
// Types
// ============================================================================

export interface QualityMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  headingCount: number;
  averageSentenceLength: number;
  averageWordsPerParagraph: number;
  readingTimeMinutes: number;
}

export interface KeywordDensity {
  keyword: string;
  count: number;
  density: number; // Percentage
  prominence: number; // Score based on position
}

export interface StructureAnalysis {
  hasTldrSection: boolean;
  hasIntroduction: boolean;
  hasConclusion: boolean;
  hasFaqSection: boolean;
  headingHierarchy: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
  };
  hasProperStructure: boolean;
}

export interface SeoAnalysis {
  titleInHeadings: boolean;
  keywordInFirstParagraph: boolean;
  internalLinks: number;
  externalLinks: number;
  images: number;
  lists: number;
  tables: number;
  metaDescriptionLength: number;
}

export interface ReadabilityScore {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  automatedReadabilityIndex: number;
  averageGradeLevel: number;
  readabilityLabel:
    | "very_easy"
    | "easy"
    | "fairly_easy"
    | "standard"
    | "fairly_difficult"
    | "difficult"
    | "very_difficult";
}

export interface QualityRecommendation {
  type: "critical" | "warning" | "suggestion";
  category: "structure" | "seo" | "readability" | "content" | "keywords";
  message: string;
  action?: string;
}

export interface ContentQualityReport {
  metrics: QualityMetrics;
  keywordDensity: KeywordDensity[];
  structure: StructureAnalysis;
  seo: SeoAnalysis;
  readability: ReadabilityScore;
  recommendations: QualityRecommendation[];
  overallScore: number; // 0-100
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Count sentences in text
 */
function countSentences(text: string): number {
  const sentencePatterns = /[.!?]+/g;
  const matches = text.match(sentencePatterns);
  return matches ? matches.length : Math.max(1, text.split(/\n\n+/).length);
}

/**
 * Count paragraphs in text
 */
function countParagraphs(text: string): number {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
}

/**
 * Extract headings from markdown
 */
function extractHeadings(markdown: string): Array<{
  level: number;
  text: string;
  position: number;
}> {
  const headings: Array<{ level: number; text: string; position: number }> = [];
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        position: i,
      });
    }
  }

  return headings;
}

/**
 * Extract all links from markdown
 */
function extractLinks(markdown: string): {
  internal: number;
  external: number;
} {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let internal = 0;
  let external = 0;

  let match;
  while ((match = linkPattern.exec(markdown)) !== null) {
    const url = match[2];
    if (url.startsWith("/") || url.startsWith("http")) {
      // Check if internal (same domain)
      if (url.startsWith("/") || url.includes("elongoat.io")) {
        internal++;
      } else {
        external++;
      }
    }
  }

  return { internal, external };
}

/**
 * Calculate keyword density in text
 */
function calculateKeywordDensity(
  text: string,
  keywords: string[],
): KeywordDensity[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const totalWords = words.length;
  const wordCounts = new Map<string, number>();

  // Count occurrences
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  const densities: KeywordDensity[] = [];

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const exactMatch = wordCounts.get(keywordLower) || 0;

    // Also check for multi-word phrases
    let phraseCount = 0;
    if (keyword.includes(" ")) {
      const phraseRegex = new RegExp(
        keywordLower.replace(/\s+/g, "\\s+"),
        "gi",
      );
      const matches = text.toLowerCase().match(phraseRegex);
      phraseCount = matches ? matches.length : 0;
    }

    const count = Math.max(exactMatch, phraseCount);
    const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

    // Calculate prominence (first 200 words get bonus)
    const firstChunk = text.slice(0, 1000).toLowerCase();
    const inFirstChunk = firstChunk.includes(keywordLower) ? 1 : 0;
    const prominence = count + inFirstChunk * 0.5;

    densities.push({
      keyword,
      count,
      density: Math.round(density * 1000) / 1000,
      prominence: Math.round(prominence * 100) / 100,
    });
  }

  return densities.sort((a, b) => b.count - a.count);
}

/**
 * Calculate Flesch-Kincaid Grade Level
 */
function calculateFleschKincaidGrade(
  sentences: number,
  words: number,
  syllables: number,
): number {
  if (sentences === 0 || words === 0) return 0;
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

/**
 * Calculate Flesch Reading Ease
 */
function calculateFleschReadingEase(
  sentences: number,
  words: number,
  syllables: number,
): number {
  if (sentences === 0 || words === 0) return 0;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

/**
 * Calculate Automated Readability Index
 */
function calculateARI(
  characters: number,
  words: number,
  sentences: number,
): number {
  if (words === 0 || sentences === 0) return 0;
  return 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43;
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

/**
 * Count total syllables in text
 */
function countTotalSyllables(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  return words.reduce((total, word) => total + countSyllables(word), 0);
}

/**
 * Get readability label from score
 */
function getReadabilityLabel(
  score: number,
): ReadabilityScore["readabilityLabel"] {
  if (score >= 90) return "very_easy";
  if (score >= 80) return "easy";
  if (score >= 70) return "fairly_easy";
  if (score >= 60) return "standard";
  if (score >= 50) return "fairly_difficult";
  if (score >= 30) return "difficult";
  return "very_difficult";
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export interface AnalyzeContentOptions {
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  targetWordCount?: number;
  targetGradeLevel?: number;
}

export function analyzeContent(
  contentMarkdown: string,
  options: AnalyzeContentOptions = {},
): ContentQualityReport {
  const primaryKeyword = options.primaryKeyword ?? "";
  const secondaryKeywords = options.secondaryKeywords ?? [];
  const targetWordCount = options.targetWordCount ?? 1000;
  const targetGradeLevel = options.targetGradeLevel ?? 10;

  const recommendations: QualityRecommendation[] = [];
  const allKeywords = [primaryKeyword, ...secondaryKeywords].filter(Boolean);

  // ==========================================================================
  // Calculate Metrics
  // ==========================================================================

  const wordCount = countWords(contentMarkdown);
  const sentenceCount = countSentences(contentMarkdown);
  const paragraphCount = countParagraphs(contentMarkdown);
  const characters = contentMarkdown.replace(/\s/g, "").length;
  const syllables = countTotalSyllables(contentMarkdown);

  const headings = extractHeadings(contentMarkdown);
  const headingCount = headings.length;

  const metrics: QualityMetrics = {
    wordCount,
    sentenceCount,
    paragraphCount,
    headingCount,
    averageSentenceLength: sentenceCount > 0 ? wordCount / sentenceCount : 0,
    averageWordsPerParagraph:
      paragraphCount > 0 ? wordCount / paragraphCount : 0,
    readingTimeMinutes: Math.ceil(wordCount / 200),
  };

  // ==========================================================================
  // Analyze Structure
  // ==========================================================================

  const headingHierarchy = { h1: 0, h2: 0, h3: 0, h4: 0 };
  for (const h of headings) {
    if (h.level === 1) headingHierarchy.h1++;
    else if (h.level === 2) headingHierarchy.h2++;
    else if (h.level === 3) headingHierarchy.h3++;
    else if (h.level === 4) headingHierarchy.h4++;
  }

  const firstParagraph = contentMarkdown.split(/\n\n+/)[0] ?? "";
  const hasTldrSection = /^##\s*(TL;DR|Tl;DR|Summary|Quick Summary)/im.test(
    contentMarkdown,
  );
  const hasIntroduction =
    /^##\s*(Introduction|Intro|Overview|Background)/im.test(contentMarkdown);
  const hasConclusion =
    /^##\s*(Conclusion|Summary|Final Thoughts|Wrap Up)/im.test(contentMarkdown);
  const hasFaqSection =
    /^##\s*(FAQ|Frequently Asked Questions|Common Questions)/im.test(
      contentMarkdown,
    );

  const hasProperStructure =
    hasTldrSection || hasIntroduction
      ? hasConclusion || hasFaqSection
      : headingHierarchy.h2 >= 3;

  const structure: StructureAnalysis = {
    hasTldrSection,
    hasIntroduction,
    hasConclusion,
    hasFaqSection,
    headingHierarchy,
    hasProperStructure,
  };

  // ==========================================================================
  // Analyze SEO Elements
  // ==========================================================================

  const links = extractLinks(contentMarkdown);
  const listMatches = contentMarkdown.match(/^\s*[-*+]\s+/gm);
  const imageMatches = contentMarkdown.match(/!\[.*?\]\(.*?\)/g);
  const tableMatches = contentMarkdown.match(/\|.*\|/g);

  const titleInHeadings = headings.some((h) =>
    h.text.toLowerCase().includes(primaryKeyword.toLowerCase()),
  );
  const keywordInFirstParagraph = primaryKeyword
    ? firstParagraph.toLowerCase().includes(primaryKeyword.toLowerCase())
    : false;

  const seo: SeoAnalysis = {
    titleInHeadings,
    keywordInFirstParagraph,
    internalLinks: links.internal,
    externalLinks: links.external,
    images: imageMatches?.length ?? 0,
    lists: listMatches?.length ?? 0,
    tables: tableMatches ? Math.floor(tableMatches.length / 2) : 0,
    metaDescriptionLength: firstParagraph.slice(0, 160).length,
  };

  // ==========================================================================
  // Calculate Readability Scores
  // ==========================================================================

  const fleschKincaidGrade = calculateFleschKincaidGrade(
    sentenceCount,
    wordCount,
    syllables,
  );
  const fleschReadingEase = calculateFleschReadingEase(
    sentenceCount,
    wordCount,
    syllables,
  );
  const ari = calculateARI(characters, wordCount, sentenceCount);

  const averageGradeLevel = (fleschKincaidGrade + ((ari - 1) * 0.5 + 6)) / 2;

  const readability: ReadabilityScore = {
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    automatedReadabilityIndex: Math.round(ari * 10) / 10,
    averageGradeLevel: Math.round(averageGradeLevel * 10) / 10,
    readabilityLabel: getReadabilityLabel(fleschReadingEase),
  };

  // ==========================================================================
  // Generate Recommendations
  // ==========================================================================

  // Word count recommendations
  if (wordCount < targetWordCount * 0.5) {
    recommendations.push({
      type: "critical",
      category: "content",
      message: `Content is significantly under target word count (${wordCount} vs ${targetWordCount} words). Expand with more detail and examples.`,
      action: "add_content",
    });
  } else if (wordCount < targetWordCount * 0.8) {
    recommendations.push({
      type: "warning",
      category: "content",
      message: `Content is under target word count (${wordCount} vs ${targetWordCount} words). Consider adding more detail.`,
      action: "expand_content",
    });
  }

  // Structure recommendations
  if (!hasTldrSection) {
    recommendations.push({
      type: "suggestion",
      category: "structure",
      message: "Add a TL;DR section at the beginning for quick scanning.",
      action: "add_tldr",
    });
  }

  if (!hasIntroduction) {
    recommendations.push({
      type: "warning",
      category: "structure",
      message:
        "Missing introduction section. Add an introduction to provide context.",
      action: "add_introduction",
    });
  }

  if (!hasConclusion && !hasFaqSection) {
    recommendations.push({
      type: "suggestion",
      category: "structure",
      message: "Consider adding a conclusion or FAQ section to wrap up.",
      action: "add_conclusion",
    });
  }

  if (headingHierarchy.h2 < 2) {
    recommendations.push({
      type: "warning",
      category: "structure",
      message: "Content needs more H2 headings for better structure and SEO.",
      action: "add_headings",
    });
  }

  // SEO recommendations
  if (primaryKeyword && !titleInHeadings) {
    recommendations.push({
      type: "warning",
      category: "seo",
      message: `Primary keyword "${primaryKeyword}" not found in any headings. Include it in an H2.`,
      action: "add_keyword_to_heading",
    });
  }

  if (primaryKeyword && !keywordInFirstParagraph) {
    recommendations.push({
      type: "suggestion",
      category: "seo",
      message: `Primary keyword "${primaryKeyword}" should appear in the first paragraph.`,
      action: "add_keyword_to_intro",
    });
  }

  if (links.internal === 0) {
    recommendations.push({
      type: "suggestion",
      category: "seo",
      message: "No internal links found. Add links to related content.",
      action: "add_internal_links",
    });
  }

  if (seo.lists < 2) {
    recommendations.push({
      type: "suggestion",
      category: "readability",
      message: "Add more bullet points or numbered lists for readability.",
      action: "add_lists",
    });
  }

  // Readability recommendations
  if (readability.averageGradeLevel > targetGradeLevel + 3) {
    recommendations.push({
      type: "warning",
      category: "readability",
      message: `Content is too complex (grade ${readability.averageGradeLevel.toFixed(1)}). Simplify language.`,
      action: "simplify_language",
    });
  } else if (readability.averageGradeLevel < targetGradeLevel - 3) {
    recommendations.push({
      type: "suggestion",
      category: "readability",
      message: `Content may be too simple (grade ${readability.averageGradeLevel.toFixed(1)}). Add more depth.`,
      action: "add_depth",
    });
  }

  if (metrics.averageSentenceLength > 25) {
    recommendations.push({
      type: "warning",
      category: "readability",
      message: "Average sentence length is too long. Break up long sentences.",
      action: "shorten_sentences",
    });
  }

  if (metrics.averageWordsPerParagraph > 200) {
    recommendations.push({
      type: "suggestion",
      category: "readability",
      message: "Paragraphs are too long. Break them into smaller chunks.",
      action: "shorten_paragraphs",
    });
  }

  // Keyword density recommendations
  const keywordDensities = calculateKeywordDensity(
    contentMarkdown,
    allKeywords,
  );
  const primaryKeywordDensity = keywordDensities.find(
    (k) => k.keyword.toLowerCase() === primaryKeyword.toLowerCase(),
  );

  if (primaryKeyword && primaryKeywordDensity) {
    if (primaryKeywordDensity.density < 0.5) {
      recommendations.push({
        type: "warning",
        category: "keywords",
        message: `Primary keyword density is low (${(primaryKeywordDensity.density * 100).toFixed(2)}%). Aim for 1-2%.`,
        action: "increase_keyword_usage",
      });
    } else if (primaryKeywordDensity.density > 3) {
      recommendations.push({
        type: "warning",
        category: "keywords",
        message: `Primary keyword density is too high (${(primaryKeywordDensity.density * 100).toFixed(2)}%). Reduce to avoid keyword stuffing.`,
        action: "reduce_keyword_usage",
      });
    }
  }

  // ==========================================================================
  // Calculate Overall Score
  // ==========================================================================

  let score = 100;

  // Word count impact (30 points max)
  if (wordCount < targetWordCount * 0.5) score -= 30;
  else if (wordCount < targetWordCount * 0.8) score -= 15;
  else if (wordCount < targetWordCount) score -= 5;

  // Structure impact (20 points max)
  if (!hasIntroduction) score -= 5;
  if (!hasConclusion && !hasFaqSection) score -= 3;
  if (headingHierarchy.h2 < 2) score -= 5;
  if (!hasProperStructure) score -= 7;

  // SEO impact (20 points max)
  if (primaryKeyword && !titleInHeadings) score -= 5;
  if (primaryKeyword && !keywordInFirstParagraph) score -= 3;
  if (links.internal === 0) score -= 5;
  if (seo.lists < 2) score -= 2;

  // Readability impact (20 points max)
  const gradeDiff = Math.abs(readability.averageGradeLevel - targetGradeLevel);
  if (gradeDiff > 5) score -= 10;
  else if (gradeDiff > 3) score -= 5;
  else if (gradeDiff > 1) score -= 2;

  if (metrics.averageSentenceLength > 25) score -= 5;
  if (metrics.averageWordsPerParagraph > 200) score -= 5;

  // Keyword impact (10 points max)
  if (primaryKeyword) {
    const density = primaryKeywordDensity?.density ?? 0;
    if (density < 0.5) score -= 5;
    else if (density > 3) score -= 5;
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    metrics,
    keywordDensity: keywordDensities,
    structure,
    seo,
    readability,
    recommendations,
    overallScore,
  };
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatQualityReport(report: ContentQualityReport): string {
  const lines: string[] = [];

  lines.push("# Content Quality Report");
  lines.push(`\n**Overall Score:** ${report.overallScore}/100`);
  lines.push("\n## Metrics");
  lines.push(`- Word Count: ${report.metrics.wordCount}`);
  lines.push(`- Sentence Count: ${report.metrics.sentenceCount}`);
  lines.push(`- Paragraph Count: ${report.metrics.paragraphCount}`);
  lines.push(`- Heading Count: ${report.metrics.headingCount}`);
  lines.push(`- Reading Time: ${report.metrics.readingTimeMinutes} minutes`);
  lines.push(
    `- Avg Sentence Length: ${report.metrics.averageSentenceLength.toFixed(1)} words`,
  );

  lines.push("\n## Structure");
  lines.push(
    `- TL;DR Section: ${report.structure.hasTldrSection ? "Yes" : "No"}`,
  );
  lines.push(
    `- Introduction: ${report.structure.hasIntroduction ? "Yes" : "No"}`,
  );
  lines.push(`- Conclusion: ${report.structure.hasConclusion ? "Yes" : "No"}`);
  lines.push(`- FAQ Section: ${report.structure.hasFaqSection ? "Yes" : "No"}`);
  lines.push(
    `- Headings: H1=${report.structure.headingHierarchy.h1}, H2=${report.structure.headingHierarchy.h2}, H3=${report.structure.headingHierarchy.h3}`,
  );

  lines.push("\n## Readability");
  lines.push(
    `- Flesch-Kincaid Grade: ${report.readability.fleschKincaidGrade}`,
  );
  lines.push(`- Reading Ease: ${report.readability.fleschReadingEase}`);
  lines.push(`- ARI: ${report.readability.automatedReadabilityIndex}`);
  lines.push(
    `- Level: ${report.readability.readabilityLabel.replace(/_/g, " ")}`,
  );

  if (report.keywordDensity.length > 0) {
    lines.push("\n## Keyword Density");
    for (const kd of report.keywordDensity.slice(0, 5)) {
      lines.push(
        `- "${kd.keyword}": ${kd.count}x (${(kd.density * 100).toFixed(2)}%)`,
      );
    }
  }

  if (report.recommendations.length > 0) {
    lines.push("\n## Recommendations");
    for (const rec of report.recommendations) {
      const emoji =
        rec.type === "critical" ? "🔴" : rec.type === "warning" ? "⚠️" : "💡";
      lines.push(`\n${emoji} **${rec.category}**: ${rec.message}`);
    }
  }

  return lines.join("\n");
}

export function getQuickQualityScore(contentMarkdown: string): {
  score: number;
  wordCount: number;
  passes: boolean;
} {
  const report = analyzeContent(contentMarkdown);
  return {
    score: report.overallScore,
    wordCount: report.metrics.wordCount,
    passes: report.overallScore >= 70,
  };
}
