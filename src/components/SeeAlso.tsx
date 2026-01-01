import Link from "next/link";
import { BookOpen, HelpCircle, FolderTree, Lightbulb } from "lucide-react";
import type { ClusterTopic, PaaQuestion } from "@/lib/indexes";

export interface SeeAlsoProps {
  /**
   * Current page type
   */
  type: "page" | "qa" | "video" | "fact";
  /**
   * Keywords to find related content
   */
  keywords?: string;
  /**
   * Topic slug for context
   */
  topicSlug?: string;
  /**
   * Current slug to exclude
   */
  currentSlug?: string;
  /**
   * Maximum items per category
   */
  limit?: number;
}

/**
 * "See Also" section for bottom of content pages
 * Shows links to related facts, Q&A, and topics
 */
export async function SeeAlso({
  type,
  keywords = "",
  topicSlug,
  currentSlug,
  limit = 4,
}: SeeAlsoProps) {
  const { getClusterIndex, getPaaIndex } = await import("@/lib/indexes");

  const [cluster, paa] = await Promise.all([getClusterIndex(), getPaaIndex()]);

  const factLinks = getRelevantFacts(keywords, type);
  const qaLinks = getRelevantQa(keywords, paa.questions, currentSlug, limit);
  const topicLinks = getRelevantTopics(
    keywords,
    topicSlug,
    cluster.topics,
    limit,
  );

  const hasContent =
    factLinks.length > 0 || qaLinks.length > 0 || topicLinks.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <aside className="glass rounded-3xl p-6 mt-8 border-l-4 border-l-accent">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" />
        See also
      </h2>

      <div className="mt-4 space-y-4">
        {/* Facts section */}
        {factLinks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <BookOpen className="h-3.5 w-3.5" />
              Quick facts
            </h3>
            <div className="flex flex-wrap gap-2">
              {factLinks.map((fact) => (
                <Link
                  key={fact.href}
                  href={fact.href}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10"
                >
                  {fact.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Q&A section */}
        {qaLinks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <HelpCircle className="h-3.5 w-3.5" />
              Related questions
            </h3>
            <ul className="space-y-1.5">
              {qaLinks.map((qa) => (
                <li key={qa.href}>
                  <Link
                    href={qa.href}
                    className="text-sm text-white/70 hover:text-white transition-colors line-clamp-1"
                  >
                    {qa.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Topics section */}
        {topicLinks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <FolderTree className="h-3.5 w-3.5" />
              Explore topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {topicLinks.map((topic) => (
                <Link
                  key={topic.href}
                  href={topic.href}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10"
                >
                  {topic.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Get relevant fact links based on keywords
 */
function getRelevantFacts(
  keywords: string,
  pageType: string,
): Array<{ label: string; href: string }> {
  const allFacts = [
    {
      label: "Age",
      href: "/facts/age",
      keywords: ["age", "old", "born", "year"],
    },
    {
      label: "Children",
      href: "/facts/children",
      keywords: ["child", "kid", "son", "daughter", "family"],
    },
    {
      label: "Date of Birth",
      href: "/facts/dob",
      keywords: ["birth", "born", "dob"],
    },
    {
      label: "Net Worth",
      href: "/facts/net-worth",
      keywords: ["money", "rich", "wealth", "billion", "net worth"],
    },
  ];

  const keywordSet = new Set(
    keywords
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

  // For facts page, don't show itself
  if (pageType === "fact") {
    return allFacts.filter((f) => !keywords.includes(f.label.toLowerCase()));
  }

  // Show facts that match keywords
  return allFacts.filter((f) =>
    f.keywords.some((k) => keywordSet.has(k.toLowerCase())),
  );
}

/**
 * Get relevant Q&A links based on keywords
 */
function getRelevantQa(
  keywords: string,
  questions: PaaQuestion[],
  excludeSlug?: string,
  limit = 4,
): Array<{ label: string; href: string }> {
  const keywordSet = new Set(
    keywords
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["the", "was", "has", "had"].includes(w)),
  );

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
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, limit)
    .map((x) => ({
      label: x.question.question,
      href: `/q/${x.question.slug}`,
    }));
}

/**
 * Get relevant topic links based on keywords
 */
function getRelevantTopics(
  keywords: string,
  currentTopicSlug?: string,
  topics?: ClusterTopic[],
  limit = 4,
): Array<{ label: string; href: string }> {
  if (!topics || topics.length === 0) {
    return [];
  }

  const keywordSet = new Set(
    keywords
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

  return topics
    .filter((t) => t.slug !== currentTopicSlug)
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
    .map((x) => ({
      label: x.topic.topic,
      href: `/${x.topic.slug}`,
    }));
}
