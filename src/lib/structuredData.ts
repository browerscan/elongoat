import { getSiteConfig } from "@/lib/seo";

const SITE_URL = getSiteConfig().url;

/**
 * Base JSON-LD context
 */
const BASE_CONTEXT = "https://schema.org";

/**
 * Generate WebSite schema
 * Describes the overall website
 */
export function generateWebSiteSchema() {
  return {
    "@context": BASE_CONTEXT,
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: getSiteConfig().name,
    description: getSiteConfig().description,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: getSiteConfig().name,
      url: SITE_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": {
        "@type": "PropertyValueSpecification",
        valueRequired: true,
        valueName: "search_term_string",
      },
    },
  };
}

/**
 * Generate Organization schema
 */
export function generateOrganizationSchema() {
  const socialUrls = ["https://twitter.com/elongoat", "https://x.com/elongoat"];

  return {
    "@context": BASE_CONTEXT,
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: getSiteConfig().name,
    url: SITE_URL,
    description: getSiteConfig().description,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/og-image.svg`,
      width: 1200,
      height: 630,
      caption: getSiteConfig().name,
    },
    sameAs: socialUrls,
  };
}

/**
 * Generate BreadcrumbList schema
 * Helps search engines understand page hierarchy
 */
export interface BreadcrumbItem {
  name: string;
  url?: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  const itemList = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    ...(item.url && { item: item.url }),
  }));

  return {
    "@context": BASE_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: itemList,
  };
}

/**
 * Generate Article schema for content pages
 */
export function generateArticleSchema(params: {
  title: string;
  description: string;
  url: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  imageUrl?: string;
  section?: string;
  keywords?: string[];
}) {
  const {
    title,
    description,
    url,
    publishedAt,
    updatedAt,
    authorName = getSiteConfig().author,
    imageUrl,
    section,
    keywords,
  } = params;

  const article: Record<string, unknown> = {
    "@context": BASE_CONTEXT,
    "@type": "Article",
    "@id": `${SITE_URL}${url}#article`,
    headline: title,
    description: description.slice(0, 160),
    url: `${SITE_URL}${url}`,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: getSiteConfig().name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
      },
    },
    author: {
      "@type": "Person",
      name: authorName,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}${url}`,
    },
  };

  if (publishedAt) {
    article.datePublished = publishedAt;
  }

  if (updatedAt) {
    article.dateModified = updatedAt;
  } else if (publishedAt) {
    article.dateModified = publishedAt;
  }

  if (imageUrl) {
    article.image = {
      "@type": "ImageObject",
      url: imageUrl,
      width: 1200,
      height: 630,
    };
  }

  if (section) {
    article.articleSection = section;
  }

  if (keywords && keywords.length > 0) {
    article.keywords = keywords.join(", ");
  }

  return article;
}

/**
 * Generate FAQPage schema for Q&A pages
 * Helps content appear in FAQ rich results
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export function generateFaqPageSchema(items: FaqItem[]) {
  const mainEntity = items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer.slice(0, 500), // Limit for schema
    },
  }));

  return {
    "@context": BASE_CONTEXT,
    "@type": "FAQPage",
    mainEntity,
  };
}

/**
 * Generate QAPage schema (newer, more detailed than FAQPage)
 */
export function generateQaPageSchema(params: {
  question: string;
  answer: string;
  url: string;
  upvoteCount?: number;
  author?: string;
  createdAt?: string;
}) {
  const { question, answer, url, upvoteCount, author, createdAt } = params;

  const qaPage: Record<string, unknown> = {
    "@context": BASE_CONTEXT,
    "@type": "QAPage",
    url: `${SITE_URL}${url}`,
    mainEntity: {
      "@type": "Question",
      name: question,
      text: question,
      answerCount: 1,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer.slice(0, 2000), // Reasonable limit
        author: {
          "@type": "Organization",
          name: author ?? getSiteConfig().name,
        },
        upvoteCount: upvoteCount ?? 0,
      },
    },
  };

  if (createdAt) {
    (qaPage.mainEntity as Record<string, unknown>).dateCreated = createdAt;
  }

  return qaPage;
}

/**
 * Generate VideoObject schema
 * Helps videos appear in video rich results
 */
export function generateVideoObjectSchema(params: {
  name: string;
  description: string;
  videoId: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  uploadDate?: string;
  duration?: string;
  channelName?: string;
  transcript?: string;
}) {
  const {
    name,
    description,
    videoId,
    thumbnailUrl,
    embedUrl = `https://www.youtube.com/embed/${videoId}`,
    uploadDate,
    duration,
    channelName,
    transcript,
  } = params;

  const video: Record<string, unknown> = {
    "@context": BASE_CONTEXT,
    "@type": "VideoObject",
    name,
    description: description.slice(0, 500),
    thumbnailUrl: [
      thumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    ],
    uploadDate,
    embedUrl,
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };

  if (duration) {
    video.duration = parseDuration(duration);
  }

  if (channelName) {
    video.creator = {
      "@type": "Organization",
      name: channelName,
    };
  }

  if (transcript) {
    video.transcript = transcript.slice(0, 2000);
  }

  return video;
}

/**
 * Parse YouTube duration format (PT4M32S) to ISO 8601
 */
function parseDuration(duration: string): string {
  // If already in ISO format, return as is
  if (duration.startsWith("PT")) {
    return duration;
  }

  // Parse format like "4:32" or "1:04:32"
  const parts = duration.split(":").map(Number);

  if (parts.length === 2) {
    // MM:SS
    return `PT${parts[0]}M${parts[1]}S`;
  } else if (parts.length === 3) {
    // HH:MM:SS
    return `PT${parts[0]}H${parts[1]}M${parts[2]}S`;
  }

  return "PT0S";
}

/**
 * Generate WebPage schema for generic pages
 */
export function generateWebPageSchema(params: {
  title: string;
  description: string;
  url: string;
  dateModified?: string;
  breadcrumbs?: BreadcrumbItem[];
}) {
  const { title, description, url, dateModified, breadcrumbs } = params;

  const webPage: Record<string, unknown> = {
    "@context": BASE_CONTEXT,
    "@type": "WebPage",
    "@id": `${SITE_URL}${url}#webpage`,
    url: `${SITE_URL}${url}`,
    name: title,
    description: description.slice(0, 160),
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
    },
    about: {
      "@type": "Thing",
      name: "Elon Musk",
      description: "Entrepreneur, CEO of Tesla and SpaceX",
    },
    breadcrumb: breadcrumbs
      ? {
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            ...(item.url && { item: item.url }),
          })),
        }
      : undefined,
  };

  if (dateModified) {
    webPage.dateModified = dateModified;
  }

  return webPage;
}

/**
 * Generate Person schema for Elon Musk
 */
export function generatePersonSchema() {
  return {
    "@context": BASE_CONTEXT,
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: "Elon Musk",
    url: `${SITE_URL}`,
    sameAs: [
      "https://twitter.com/elonmusk",
      "https://www.wikipedia.org/wiki/Elon_Musk",
    ],
    jobTitle: "CEO",
    worksFor: [
      {
        "@type": "Organization",
        name: "Tesla",
      },
      {
        "@type": "Organization",
        name: "SpaceX",
      },
      {
        "@type": "Organization",
        name: "X Corp",
      },
    ],
  };
}

/**
 * Generate ProfilePage schema for topic hubs
 */
export function generateProfilePageSchema(params: {
  topic: string;
  description: string;
  url: string;
  pageCount?: number;
}) {
  const { topic, description, url, pageCount } = params;

  return {
    "@context": BASE_CONTEXT,
    "@type": "CollectionPage",
    name: `${topic} — Topic Hub`,
    description: description.slice(0, 160),
    url: `${SITE_URL}${url}`,
    about: {
      "@type": "Thing",
      name: topic,
    },
    numberOfItems: pageCount ?? 0,
  };
}

/**
 * Aggregate multiple schemas into a single JSON-LD array
 * Useful for pages that need multiple schema types
 */
export function combineSchemas(...schemas: Record<string, unknown>[]) {
  return schemas;
}

/**
 * Type guard for schema objects
 */
export function isValidSchema(obj: unknown): obj is Record<string, unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "@context" in obj &&
    "@type" in obj
  );
}
