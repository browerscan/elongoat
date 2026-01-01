import Link from "next/link";

import {
  ArrowUpRight,
  FolderTree,
  FileText,
  MessageSquare,
  Video,
} from "lucide-react";

// Shared types for search (mirrored from API route)
// Note: These types must match the API route response
export type SearchResultItem = {
  id: string;
  title: string;
  snippet?: string;
  url: string;
  type: "topic" | "page" | "qa" | "video";
  meta?: string;
};

export type SearchResponse = {
  results: {
    topics: SearchResultItem[];
    pages: SearchResultItem[];
    qa: SearchResultItem[];
    videos: SearchResultItem[];
  };
  total: number;
  query: string;
};

const typeIcons = {
  topics: FolderTree,
  pages: FileText,
  qa: MessageSquare,
  videos: Video,
};

const typeLabels = {
  topics: "Topic Hub",
  pages: "Page",
  qa: "Q&A",
  videos: "Video",
};

// Type for icon lookup
type ResultCategory = keyof SearchResponse["results"];

type Props = {
  results: SearchResponse["results"];
  totalCount: number;
  isLoading: boolean;
};

export function SearchResults({ results, totalCount, isLoading }: Props) {
  if (isLoading) {
    return <SearchResultsSkeleton />;
  }

  if (totalCount === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <MessageSquare className="h-5 w-5 text-white/40" />
        </div>
        <h3 className="text-lg font-medium text-white">No results found</h3>
        <p className="mt-2 text-sm text-white/60">
          Try different keywords or browse our topics.
        </p>
        <Link
          href="/topics"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10"
        >
          Browse all topics
        </Link>
      </div>
    );
  }

  const allCategories = (
    Object.entries(results) as Array<
      [keyof typeof results, (typeof results)[keyof typeof results]]
    >
  ).filter(([, items]) => items.length > 0);

  return (
    <div className="space-y-6">
      {totalCount > 0 ? (
        <div className="text-sm text-white/60">
          Found <span className="font-semibold text-white">{totalCount}</span>{" "}
          result{totalCount !== 1 ? "s" : ""}
        </div>
      ) : null}

      {allCategories.map(([category, items]) => {
        const Icon = typeIcons[category as ResultCategory];
        const label = typeLabels[category as ResultCategory];

        return (
          <section key={category} className="glass rounded-3xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <Icon className="h-4 w-4 text-white/60" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">
                {label} ({items.length})
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <SearchResultItem key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SearchResultItem({
  item,
}: {
  item: SearchResponse["results"][keyof SearchResponse["results"]][number];
}) {
  // Map singular type to plural category key
  const typeToCategory: Record<string, ResultCategory> = {
    topic: "topics",
    page: "pages",
    qa: "qa",
    video: "videos",
  };
  const Icon = typeIcons[typeToCategory[item.type] || "topics"];

  return (
    <Link
      href={item.url}
      className="group rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10">
          <Icon className="h-3 w-3 text-white/70" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-white group-hover:text-white/90">
              {item.title}
            </h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-white/60" />
          </div>
          {item.snippet ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/50">
              {item.snippet}
            </p>
          ) : null}
          {item.meta ? (
            <div className="mt-2 text-[11px] text-white/40">{item.meta}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass rounded-2xl p-4 animate-pulse bg-white/5"
          >
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-md bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
