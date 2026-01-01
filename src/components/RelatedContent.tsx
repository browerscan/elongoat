import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ClusterTopic, PaaQuestion } from "@/lib/indexes";

export interface RelatedContentProps {
  /**
   * Current content context for finding related items
   */
  type: "topic" | "page" | "qa" | "video" | "fact";
  /**
   * Current topic slug (for finding related pages in same topic)
   */
  topicSlug?: string;
  /**
   * Current page slug (to exclude from results)
   */
  currentSlug?: string;
  /**
   * Question text for extracting keywords (Q&A pages)
   */
  questionText?: string;
  /**
   * Maximum items to show per section
   */
  limit?: number;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Related content section that shows contextually relevant links
 * - For topic pages: shows related keyword pages
 * - For Q&A pages: shows related questions and topics
 * - For video pages: shows related videos and topics
 */
export async function RelatedContent({
  type,
  topicSlug,
  currentSlug,
  questionText,
  limit = 6,
  className = "",
}: RelatedContentProps) {
  const { getClusterIndex, getPaaIndex, listTopicPages } =
    await import("@/lib/indexes");

  const [cluster, paa] = await Promise.all([getClusterIndex(), getPaaIndex()]);

  const sections: Array<{
    title: string;
    items: Array<{ title: string; url: string; meta?: string }>;
  }> = [];

  // Topic hub page - show pages in this topic
  if (type === "topic" && topicSlug) {
    const topicPages = await listTopicPages(topicSlug);
    const pages = topicPages
      .filter((p) => p.slug !== currentSlug)
      .slice(0, limit);

    if (pages.length > 0) {
      sections.push({
        title: "Pages in this topic",
        items: pages.map((p) => ({
          title: p.page,
          url: `/${p.slug}`,
          meta: `Peak ${p.maxVolume.toLocaleString()} • ${p.keywordCount} keywords`,
        })),
      });
    }

    // Add related topics based on similar keywords
    const currentTopic = cluster.topics.find((t) => t.slug === topicSlug);
    if (currentTopic) {
      const relatedTopics = findRelatedTopics(currentTopic, cluster.topics);
      if (relatedTopics.length > 0) {
        sections.push({
          title: "Related topics",
          items: relatedTopics.map((t) => ({
            title: t.topic,
            url: `/${t.slug}`,
            meta: `${t.pageCount} pages • vol ${t.totalVolume.toLocaleString()}`,
          })),
        });
      }
    }
  }

  // Keyword page - show more in topic + related topics
  if (type === "page" && topicSlug) {
    const topicPages = await listTopicPages(topicSlug);
    const pages = topicPages
      .filter((p) => p.slug !== currentSlug)
      .slice(0, limit);

    if (pages.length > 0) {
      sections.push({
        title: "More in this topic",
        items: pages.map((p) => ({
          title: p.page,
          url: `/${p.slug}`,
          meta: `Peak ${p.maxVolume.toLocaleString()} • ${p.keywordCount} keywords`,
        })),
      });
    }

    // Find related Q&A
    const relatedQa = findRelatedQaByTopic(topicSlug, paa.questions, limit);
    if (relatedQa.length > 0) {
      sections.push({
        title: "Related questions",
        items: relatedQa.map((q) => ({
          title: q.question,
          url: `/q/${q.slug}`,
          meta: q.volume ? `Vol ${q.volume.toLocaleString()}` : undefined,
        })),
      });
    }
  }

  // Q&A page - show related questions and relevant topics
  if (type === "qa") {
    // Related questions by keyword matching
    if (questionText) {
      const relatedQa = findRelatedQaByKeywords(
        questionText,
        paa.questions,
        currentSlug,
        limit,
      );
      if (relatedQa.length > 0) {
        sections.push({
          title: "Related questions",
          items: relatedQa.map((q) => ({
            title: q.question,
            url: `/q/${q.slug}`,
            meta: q.volume ? `Vol ${q.volume.toLocaleString()}` : undefined,
          })),
        });
      }
    }

    // Relevant topics based on question keywords
    const relevantTopics = findTopicsByKeywords(
      questionText ?? "",
      cluster.topics,
      4,
    );
    if (relevantTopics.length > 0) {
      sections.push({
        title: "Explore more about",
        items: relevantTopics.map((t) => ({
          title: t.topic,
          url: `/${t.slug}`,
          meta: `${t.pageCount} pages`,
        })),
      });
    }
  }

  // Video page - show topics and Q&A
  if (type === "video") {
    sections.push({
      title: "Browse topics",
      items: cluster.topics.slice(0, limit).map((t) => ({
        title: t.topic,
        url: `/${t.slug}`,
        meta: `${t.pageCount} pages`,
      })),
    });
  }

  // Fact page - show relevant topics
  if (type === "fact") {
    const factKeywords = getFactKeywords(currentSlug ?? "");
    const relevantTopics = findTopicsByKeywords(
      factKeywords,
      cluster.topics,
      limit,
    );
    if (relevantTopics.length > 0) {
      sections.push({
        title: "Learn more",
        items: relevantTopics.map((t) => ({
          title: t.topic,
          url: `/${t.slug}`,
          meta: `${t.pageCount} pages`,
        })),
      });
    }
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {sections.map((section) => (
        <section key={section.title} className="glass rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-white">{section.title}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {section.items.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors line-clamp-2">
                    {item.title}
                  </div>
                  {item.meta && (
                    <div className="mt-1 text-xs text-white/60">
                      {item.meta}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Find topics related to the current topic based on name similarity
 */
function findRelatedTopics(
  currentTopic: ClusterTopic,
  allTopics: ClusterTopic[],
  limit = 6,
): ClusterTopic[] {
  const currentWords = new Set(currentTopic.topic.toLowerCase().split(/\s+/));

  return allTopics
    .filter((t) => t.slug !== currentTopic.slug)
    .map((topic) => {
      const topicWords = topic.topic.toLowerCase().split(/\s+/);
      const overlap = topicWords.filter((w) => currentWords.has(w)).length;
      return { topic, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap || b.topic.totalVolume - a.topic.totalVolume,
    )
    .slice(0, limit)
    .map((x) => x.topic);
}

/**
 * Find Q&A related to a topic
 */
function findRelatedQaByTopic(
  topicSlug: string,
  questions: PaaQuestion[],
  limit = 6,
): PaaQuestion[] {
  const topicLower = topicSlug.replace(/-/g, " ");
  const topicWords = new Set(
    topicLower.split(/\s+/).filter((w) => w.length > 2),
  );

  return questions
    .map((q) => {
      const questionLower = q.question.toLowerCase();
      const matchCount = [...topicWords].filter((w) =>
        questionLower.includes(w),
      ).length;
      return { question: q, matchCount };
    })
    .filter((x) => x.matchCount > 0)
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount ||
        (b.question.volume ?? 0) - (a.question.volume ?? 0),
    )
    .slice(0, limit)
    .map((x) => x.question);
}

/**
 * Find related Q&A by keyword matching
 */
function findRelatedQaByKeywords(
  questionText: string,
  questions: PaaQuestion[],
  excludeSlug?: string,
  limit = 6,
): PaaQuestion[] {
  const keywords = extractKeywords(questionText);
  const keywordSet = new Set(keywords);

  return questions
    .filter((q) => q.slug !== excludeSlug)
    .map((q) => {
      const questionLower = q.question.toLowerCase();
      const matchCount = [...keywordSet].filter((k) =>
        questionLower.includes(k),
      ).length;
      return { question: q, matchCount };
    })
    .filter((x) => x.matchCount > 0)
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount ||
        (b.question.volume ?? 0) - (a.question.volume ?? 0),
    )
    .slice(0, limit)
    .map((x) => x.question);
}

/**
 * Find topics matching keywords
 */
function findTopicsByKeywords(
  keywords: string,
  topics: ClusterTopic[],
  limit = 6,
): ClusterTopic[] {
  const keywordSet = new Set(extractKeywords(keywords).slice(0, 10));

  return topics
    .map((topic) => {
      const topicLower = topic.topic.toLowerCase();
      const matchCount = [...keywordSet].filter((k) =>
        topicLower.includes(k),
      ).length;
      return { topic, matchCount };
    })
    .filter((x) => x.matchCount > 0)
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount ||
        b.topic.totalVolume - a.topic.totalVolume,
    )
    .slice(0, limit)
    .map((x) => x.topic);
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
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
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "what",
    "when",
    "where",
    "who",
    "why",
    "how",
    "this",
    "that",
    "these",
    "those",
    "his",
    "her",
    "their",
    "its",
    "about",
    "from",
    "with",
    "for",
    "after",
  ]);

  return text
    .toLowerCase()
    .replace(/[?'"]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

/**
 * Get keywords for fact pages
 */
function getFactKeywords(factSlug: string): string {
  const keywordMap: Record<string, string> = {
    age: "age old born birth year date",
    children: "kids child son daughter family",
    dob: "birth born date year",
    "net-worth": "money rich billion millionaire wealth assets",
  };
  return keywordMap[factSlug] ?? factSlug.replace(/-/g, " ");
}
