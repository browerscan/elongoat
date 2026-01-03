import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface SemanticRelatedItem {
  title: string;
  url: string;
  relevance_score: number;
  source: "content_cache" | "paa" | "cluster";
  snippet?: string;
}

export interface SemanticRelatedContentProps {
  items: SemanticRelatedItem[];
  title?: string;
  className?: string;
}

/**
 * Related content section using semantic similarity (embedding-based)
 * Items are pre-fetched using ragHybridSearch on the server
 */
export function SemanticRelatedContent({
  items,
  title = "Related content",
  className = "",
}: SemanticRelatedContentProps) {
  if (items.length === 0) {
    return null;
  }

  // Group by source type for better UX
  const contentItems = items.filter((i) => i.source === "content_cache");
  const qaItems = items.filter((i) => i.source === "paa");
  const clusterItems = items.filter((i) => i.source === "cluster");

  const sections: Array<{
    title: string;
    items: SemanticRelatedItem[];
  }> = [];

  if (contentItems.length > 0) {
    sections.push({ title: "Related articles", items: contentItems });
  }
  if (qaItems.length > 0) {
    sections.push({ title: "Related questions", items: qaItems });
  }
  if (clusterItems.length > 0) {
    sections.push({ title: "Explore topics", items: clusterItems });
  }

  // If no grouping makes sense, show all together
  if (sections.length === 0 && items.length > 0) {
    sections.push({ title, items });
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
                  {item.snippet && (
                    <div className="mt-1 text-xs text-white/60 line-clamp-2">
                      {item.snippet}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
                    <span className="capitalize">
                      {item.source.replace("_", " ")}
                    </span>
                    <span>|</span>
                    <span>{Math.round(item.relevance_score * 100)}% match</span>
                  </div>
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
