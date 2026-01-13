import type { Metadata } from "next";
import {
  combineSchemas,
  generateWebSiteSchema,
  generateOrganizationSchema,
  generatePersonSchema,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateQaPageSchema,
  generateVideoObjectSchema,
  generateWebPageSchema,
  generateProfilePageSchema,
  generateAboutPageSchema,
  generateSocialMediaPostingSchema,
  generateSpeakableSchema,
  type BreadcrumbItem,
} from "./structuredData";

/**
 * SEO utility functions for generating complete schema combinations
 * This library helps pages generate multiple schema types efficiently
 */

/**
 * Generate all base schemas (WebSite, Organization, Person)
 * Include on homepage for maximum entity coverage
 */
export function getBaseSchemas() {
  return combineSchemas(
    generateWebSiteSchema(),
    generateOrganizationSchema(),
    generatePersonSchema(),
  );
}

/**
 * Generate schema bundle for article/content pages
 * Includes: Article + Breadcrumb + WebPage
 */
export function getArticleSchemaBundle(params: {
  title: string;
  description: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  publishedAt?: string;
  updatedAt?: string;
  imageUrl?: string;
  section?: string;
  keywords?: string;
}) {
  return combineSchemas(
    generateArticleSchema({
      title: params.title,
      description: params.description,
      url: params.url,
      publishedAt: params.publishedAt,
      updatedAt: params.updatedAt,
      imageUrl: params.imageUrl,
      section: params.section,
      keywords: params.keywords?.split(","),
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
    generateWebPageSchema({
      title: params.title,
      description: params.description,
      url: params.url,
      dateModified: params.updatedAt,
      breadcrumbs: params.breadcrumbs,
    }),
  );
}

/**
 * Generate schema bundle for Q&A pages
 * Includes: QAPage + Breadcrumb + FAQPage (for related questions)
 */
export function getQaSchemaBundle(params: {
  question: string;
  answer: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  relatedQuestions?: Array<{ question: string; answer: string }>;
  upvoteCount?: number;
  createdAt?: string;
}) {
  const schemas = [
    generateQaPageSchema({
      question: params.question,
      answer: params.answer,
      url: params.url,
      upvoteCount: params.upvoteCount,
      createdAt: params.createdAt,
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
  ];

  // Add FAQPage if we have related questions
  if (params.relatedQuestions && params.relatedQuestions.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: params.relatedQuestions.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.answer.slice(0, 500),
        },
      })),
    });
  }

  return combineSchemas(...schemas);
}

/**
 * Generate schema bundle for video pages
 * Includes: VideoObject + Breadcrumb
 */
export function getVideoSchemaBundle(params: {
  name: string;
  description: string;
  videoId: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  uploadDate?: string;
  duration?: string;
  channelName?: string;
  thumbnailUrl?: string;
  transcript?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}) {
  return combineSchemas(
    generateVideoObjectSchema({
      name: params.name,
      description: params.description,
      videoId: params.videoId,
      thumbnailUrl: params.thumbnailUrl,
      uploadDate: params.uploadDate,
      duration: params.duration,
      channelName: params.channelName,
      transcript: params.transcript,
      viewCount: params.viewCount,
      likeCount: params.likeCount,
      commentCount: params.commentCount,
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
  );
}

/**
 * Generate schema bundle for topic hub pages
 * Includes: CollectionPage + Breadcrumb
 */
export function getTopicHubSchemaBundle(params: {
  topic: string;
  description: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  pageCount: number;
  totalVolume?: number;
}) {
  return combineSchemas(
    generateProfilePageSchema({
      topic: params.topic,
      description: params.description,
      url: params.url,
      pageCount: params.pageCount,
      mainEntity: {
        "@type": "Person",
        name: "Elon Musk",
        description: "Entrepreneur, CEO of Tesla and SpaceX",
        sameAs: ["https://twitter.com/elonmusk", "https://x.com/elonmusk"],
      },
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
  );
}

/**
 * Generate schema bundle for facts pages
 * Includes: AboutPage + Breadcrumb + Person reference
 */
export function getFactPageSchemaBundle(params: {
  title: string;
  description: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  factType: string;
  factValue: string | number;
  dateVerified?: string;
}) {
  return combineSchemas(
    generateAboutPageSchema({
      title: params.title,
      description: params.description,
      url: params.url,
      subject: "Elon Musk",
      facts: [
        {
          name: params.factType,
          value: params.factValue,
          dateVerified: params.dateVerified,
        },
      ],
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
  );
}

/**
 * Generate schema bundle for tweet pages
 * Includes: SocialMediaPosting + Breadcrumb
 */
export function getTweetSchemaBundle(params: {
  text: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  sourceUrl?: string;
  datePublished?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  viewCount?: number;
}) {
  return combineSchemas(
    generateSocialMediaPostingSchema({
      text: params.text,
      url: params.url,
      sourceUrl: params.sourceUrl,
      datePublished: params.datePublished,
      likeCount: params.likeCount,
      replyCount: params.replyCount,
      retweetCount: params.retweetCount,
      viewCount: params.viewCount,
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
  );
}

/**
 * Generate schema bundle with speakable optimization
 * Includes: Article + Speakable + Breadcrumb
 */
export function getSpeakableArticleSchemaBundle(params: {
  title: string;
  description: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  speakableSelectors?: string[];
  publishedAt?: string;
  updatedAt?: string;
}) {
  return combineSchemas(
    generateArticleSchema({
      title: params.title,
      description: params.description,
      url: params.url,
      publishedAt: params.publishedAt,
      updatedAt: params.updatedAt,
    }),
    generateSpeakableSchema({
      url: params.url,
      cssSelector: params.speakableSelectors,
    }),
    generateBreadcrumbSchema(params.breadcrumbs),
  );
}

/**
 * Helper to build structured data for metadata
 * Returns schemas formatted for Next.js metadata
 */
export function buildStructuredDataForMetadata(
  schemas: Record<string, unknown> | Record<string, unknown>[],
): string {
  const schemasArray = Array.isArray(schemas) ? schemas : [schemas];
  return JSON.stringify(schemasArray);
}

/**
 * Generate complete metadata with structured data
 * Combines Next.js metadata with JSON-LD schemas
 */
export function generateMetadataWithSchemas(params: {
  metadata: Metadata;
  schemas: Record<string, unknown> | Record<string, unknown>[];
}): Metadata {
  const { metadata, schemas } = params;
  const schemasArray = Array.isArray(schemas) ? schemas : [schemas];

  return {
    ...metadata,
    other: {
      ...((metadata.other as Record<string, string>) ?? {}),
      "application/ld+json": JSON.stringify(schemasArray),
    },
  };
}

/**
 * Extract keywords from text for SEO
 * Simple keyword extraction based on word frequency
 */
export function extractKeywords(text: string, limit = 10): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "to",
    "of",
    "in",
    "for",
    "on",
    "at",
    "by",
    "with",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
  ]);

  // Tokenize and count
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/);
  const frequency: Record<string, number> = {};

  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      frequency[word] = (frequency[word] ?? 0) + 1;
    }
  }

  // Sort by frequency and return top keywords
  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word]) => word);
}

/**
 * Generate search-friendly URL slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/**
 * Calculate SEO score based on content metrics
 * Returns a score from 0-100
 */
export function calculateSeoScore(params: {
  titleLength: number;
  descriptionLength: number;
  contentLength: number;
  keywordCount: number;
  hasHeadings: boolean;
  hasImages: boolean;
  hasInternalLinks: boolean;
}): number {
  let score = 0;

  // Title: optimal 50-60 chars
  if (params.titleLength >= 50 && params.titleLength <= 60) score += 20;
  else if (params.titleLength >= 30 && params.titleLength <= 70) score += 10;

  // Description: optimal 150-160 chars
  if (params.descriptionLength >= 150 && params.descriptionLength <= 160)
    score += 15;
  else if (params.descriptionLength >= 120 && params.descriptionLength <= 180)
    score += 10;

  // Content length: optimal 1000+ words
  if (params.contentLength >= 5000) score += 25;
  else if (params.contentLength >= 2000) score += 20;
  else if (params.contentLength >= 1000) score += 15;

  // Keywords
  if (params.keywordCount >= 5) score += 10;
  else if (params.keywordCount >= 3) score += 5;

  // Structure elements
  if (params.hasHeadings) score += 15;
  if (params.hasImages) score += 7;
  if (params.hasInternalLinks) score += 8;

  return Math.min(100, score);
}
