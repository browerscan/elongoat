import type { Metadata } from "next";

// Define types that match Next.js metadata expectations
export interface OpenGraph {
  type?: string;
  title: string;
  description: string;
  images?: { url: string; width?: number; height?: number; alt?: string }[];
  siteName?: string;
  url?: string;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    authors?: readonly string[];
    section?: string;
    tags?: readonly string[];
  };
}

export interface TwitterCard {
  card: string;
  title: string;
  description: string;
  images?: string[];
  creator?: string;
  site?: string;
}

/**
 * Site configuration
 * Update these values to match your brand
 */
const SITE_CONFIG = {
  name: "ElonGoat",
  title: "ElonGoat — Digital Elon (AI)",
  description:
    "A sci-fi knowledge base + streaming AI chat inspired by Elon Musk (not affiliated). Browse 13 topic hubs and 569 keyword pages built from real search demand.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io").replace(
    /\/$/,
    "",
  ),
  ogImage: "/og-image.png",
  twitterHandle: "@elongoat",
  twitterCard: "summary_large_image" as const,
  author: "ElonGoat",
  keywords: [
    "Elon Musk",
    "AI chat",
    "knowledge base",
    "ElonSim",
    "Tesla",
    "SpaceX",
    "X/Twitter",
    "tech questions",
  ] as string[],
} as const;

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + "...";
}

/**
 * SEO metadata interface
 */
export interface SeoMetadata {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogType?: "website" | "article" | "video.other";
  noindex?: boolean;
  nofollow?: boolean;
  keywords?: string[];
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

/**
 * Generate production-grade metadata for a page
 * Follows Google SEO guidelines and best practices
 */
export function generateMetadata(params: SeoMetadata): Metadata {
  const {
    title,
    description,
    path,
    ogImage,
    ogType = "website",
    noindex = false,
    nofollow = false,
    keywords,
    publishedTime,
    modifiedTime,
    section,
    tags,
  } = params;

  // Ensure title is within optimal length (50-60 chars)
  const seoTitle = truncate(title, 60);
  const fullTitle = `${seoTitle} — ${SITE_CONFIG.name}`;

  // Ensure description is within optimal length (150-160 chars)
  const seoDescription = truncate(description, 160);

  // Build canonical URL
  const canonicalUrl = `${SITE_CONFIG.url}${path}`;

  // Build Open Graph metadata
  const openGraph: OpenGraph = {
    type: ogType,
    url: canonicalUrl,
    title: fullTitle,
    description: seoDescription,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: ogImage
          ? `${SITE_CONFIG.url}${ogImage}`
          : `${SITE_CONFIG.url}${SITE_CONFIG.ogImage}`,
        width: 1200,
        height: 630,
        alt: seoTitle,
      },
    ],
  };

  // Add article-specific OG tags
  if (ogType === "article" || ogType === "video.other") {
    openGraph.article = {
      publishedTime: publishedTime,
      modifiedTime: modifiedTime,
      authors: [SITE_CONFIG.author],
      section: section,
      tags: tags ?? keywords,
    };
  }

  // Build Twitter Card metadata
  const twitter: TwitterCard = {
    card: SITE_CONFIG.twitterCard,
    title: fullTitle,
    description: seoDescription,
    images: [
      ogImage
        ? `${SITE_CONFIG.url}${ogImage}`
        : `${SITE_CONFIG.url}${SITE_CONFIG.ogImage}`,
    ],
    creator: SITE_CONFIG.twitterHandle,
    site: SITE_CONFIG.twitterHandle,
  };

  return {
    title: fullTitle,
    description: seoDescription,
    keywords: (keywords ?? SITE_CONFIG.keywords) as string[],
    authors: [{ name: SITE_CONFIG.author }],
    robots: {
      index: !noindex,
      follow: !nofollow,
      googleBot: {
        index: !noindex,
        follow: !nofollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph,
    twitter,
    alternates: {
      canonical: canonicalUrl,
      // Future-proof: add language alternatives here
      // languages: {
      //   'en': canonicalUrl,
      //   'es': `${SITE_CONFIG.url}/es${path}`,
      // },
    },
  };
}

/**
 * Generate homepage metadata
 */
export function generateHomeMetadata(): Metadata {
  return generateMetadata({
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    path: "/",
    keywords: [
      "Elon Musk",
      "AI chat",
      "ElonGoat",
      "knowledge base",
      "Q&A",
      "Elon simulation",
    ],
  });
}

/**
 * Generate topic hub metadata
 */
export function generateTopicMetadata(params: {
  topic: string;
  pageCount: number;
  totalVolume: number;
}): Metadata {
  const { topic, pageCount, totalVolume } = params;
  const title = `${topic} — Topic Hub`;
  const description = `Browse ${pageCount.toLocaleString()} pages in the "${topic}" topic hub. Total search volume: ${totalVolume.toLocaleString()}. Explore keyword clusters and AI-generated answers.`;

  return generateMetadata({
    title,
    description,
    path: `/${slugify(topic)}`,
    keywords: [topic, "topic hub", "Elon Musk", "keyword research"],
    section: "Topics",
  });
}

/**
 * Generate keyword page metadata
 */
export function generateClusterPageMetadata(params: {
  page: string;
  topic: string;
  maxVolume: number;
  keywordCount: number;
  topicSlug: string;
  pageSlug: string;
}): Metadata {
  const { page, topic, maxVolume, keywordCount, topicSlug, pageSlug } = params;
  const title = `${page} — ${topic}`;
  const description = `Explore "${page}" in ${topic}. Peak search volume: ${maxVolume.toLocaleString()}. ${keywordCount.toLocaleString()} keywords with search intent analysis and AI chat.`;

  return generateMetadata({
    title,
    description,
    path: `/${topicSlug}/${pageSlug}`,
    ogType: "article",
    keywords: [page, topic, "keywords", "search volume", "SEO"],
    section: topic,
    tags: [page, topic, "keyword analysis"],
  });
}

/**
 * Generate Q&A page metadata
 */
export function generateQaMetadata(params: {
  question: string;
  answer?: string | null;
  slug: string;
  volume?: number;
}): Metadata {
  const { question, answer, slug, volume } = params;
  const title = question;
  const description =
    answer?.slice(0, 140) ??
    `Get answers to "${question}" on ElonGoat. AI-generated responses with sources and verification notes. ${volume ? `Search volume: ${volume.toLocaleString()}.` : ""}`;

  return generateMetadata({
    title,
    description,
    path: `/q/${slug}`,
    ogType: "article",
    keywords: [question, "Q&A", "Elon Musk", "answer"],
    section: "Q&A",
    tags: ["Q&A", "question", "answer"],
  });
}

/**
 * Generate video page metadata
 */
export function generateVideoMetadata(params: {
  title: string;
  videoId: string;
  channel?: string | null;
  duration?: string | null;
  publishedAt?: string | null;
  description?: string | null;
}): Metadata {
  const { title, videoId, channel, duration, description } = params;
  const fullTitle = title ?? `Video ${videoId}`;
  const videoDescription =
    description ??
    `Watch "${fullTitle}"${channel ? ` from ${channel}` : ""}. ${duration ? `Duration: ${duration}.` : ""} Video details and transcript for AI chat grounding.`;

  return generateMetadata({
    title: fullTitle,
    description: videoDescription,
    path: `/videos/${videoId}`,
    ogImage: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    ogType: "video.other",
    keywords: [
      fullTitle,
      "video",
      "Elon Musk",
      "YouTube",
      channel ?? "",
    ].filter(Boolean),
    section: "Videos",
    tags: ["video", "Elon Musk", channel ?? "YouTube"],
  });
}

/**
 * Generate facts page metadata
 */
export function generateFactMetadata(params: {
  title: string;
  value: string;
  description: string;
  fact: string;
}): Metadata {
  const { title, value, description, fact } = params;
  const fullTitle = title;
  const fullDescription = `${description} Current value: ${value}. Quick facts about Elon Musk with live variables and AI chat.`;

  return generateMetadata({
    title: fullTitle,
    description: fullDescription,
    path: `/facts/${fact}`,
    keywords: [title, "fact", "Elon Musk", "quick info"],
    section: "Facts",
    tags: ["fact", "quick info", "Elon Musk"],
  });
}

/**
 * Generate error page metadata (noindex)
 */
export function generateErrorMetadata(title: string): Metadata {
  return {
    title: `${title} — ${SITE_CONFIG.name}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * Get site config for use in components
 */
export function getSiteConfig() {
  return SITE_CONFIG;
}

/**
 * Simple slugify for URL generation
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Generate JSON-LD script tag content for use in pages
 */
export interface JsonLdProps {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Create a JSON-LD script element
 */
export function createJsonLdScript(props: JsonLdProps): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": props.type,
    ...props.data,
  });
}
