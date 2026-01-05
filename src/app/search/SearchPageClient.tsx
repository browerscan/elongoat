"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  Globe,
  HelpCircle,
  Rocket,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";

import { SearchInput } from "../../components/SearchInput";
import { SearchResults } from "../../components/SearchResults";
import type { SearchResponse } from "../../lib/types/search";

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse["results"]>({
    topics: [],
    pages: [],
    qa: [],
    videos: [],
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    setQuery(q);

    if (q.length >= 2) {
      performSearch(q);
    } else {
      setResults({ topics: [], pages: [], qa: [], videos: [] });
      setTotalCount(0);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function performSearch(searchQuery: string) {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`,
        { signal: controller.signal },
      );
      if (requestId !== requestIdRef.current) return;
      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results);
        setTotalCount(data.totalCount);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setResults({ topics: [], pages: [], qa: [], videos: [] });
      setTotalCount(0);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  const handleSearchChange = (value: string) => {
    setQuery(value);

    if (value.trim().length >= 2) {
      const params = new URLSearchParams();
      params.set("q", value.trim());
      startTransition(() => {
        router.push(`/search?${params.toString()}`);
      });
    } else if (value.trim().length === 0) {
      startTransition(() => {
        router.push("/search");
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Search Header */}
      <header className="hero-cosmic glass-premium glow-ring rounded-3xl p-6 md:p-8">
        <div className="relative">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs text-accent">
                <Search className="h-3.5 w-3.5" />
                Command Center
              </div>
              <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                <span className="text-gradient-bold">Search</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Search everything about Elon Musk. Topics, articles, Q&A, and
                videos — all powered by AI.
              </p>

              {/* Search Input */}
              <div className="mt-6">
                <SearchInput
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Search topics, pages, Q&A, videos..."
                  autoFocus
                />
              </div>

              {/* Quick Stats */}
              {totalCount > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="badge-ai">
                    <Sparkles className="h-3 w-3" />
                    {totalCount} results
                  </div>
                </div>
              )}
            </div>

            {/* Quick Navigation */}
            <div className="flex flex-wrap gap-2 md:flex-col">
              <Link href="/" className="badge-x">
                <Globe className="h-3 w-3" />
                Home
              </Link>
              <Link href="/topics" className="badge-x">
                <Brain className="h-3 w-3" />
                Topics
              </Link>
              <Link href="/q" className="badge-x">
                <HelpCircle className="h-3 w-3" />
                Q&A
              </Link>
            </div>
          </div>
        </div>
      </header>

      {query.length >= 2 || totalCount > 0 ? (
        <SearchResults
          results={results}
          totalCount={totalCount}
          isLoading={isLoading}
        />
      ) : (
        <div className="glass-premium rounded-3xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent2/20">
            <Rocket className="h-6 w-6 text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            Start Your Search
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-white/60">
            Enter at least 2 characters to search our knowledge base. Find
            topics, articles, questions, and videos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/topics" className="topic-card">
              <Brain className="h-4 w-4 text-accent" />
              <span className="text-sm text-white">Browse Topics</span>
            </Link>
            <Link href="/q" className="topic-card">
              <HelpCircle className="h-4 w-4 text-accent2" />
              <span className="text-sm text-white">Q&A</span>
            </Link>
            <Link href="/facts" className="topic-card">
              <Zap className="h-4 w-4 text-accent3" />
              <span className="text-sm text-white">Facts</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchPageClient() {
  // For static export, wrap in Suspense
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchInner />
    </Suspense>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="hero-cosmic glass-premium glow-ring rounded-3xl p-6 md:p-8">
        <div className="shimmer-skeleton animate-shimmer h-6 w-32 rounded-full mb-4" />
        <div className="shimmer-skeleton animate-shimmer h-10 w-48 rounded-lg mb-3 delay-75" />
        <div className="shimmer-skeleton animate-shimmer h-4 w-80 rounded mb-6 delay-150" />
        <div className="shimmer-skeleton animate-shimmer h-12 w-full rounded-xl" />
      </div>
      <div className="glass-premium rounded-3xl p-8">
        <div className="flex justify-center">
          <div className="shimmer-skeleton animate-shimmer h-14 w-14 rounded-2xl" />
        </div>
        <div className="shimmer-skeleton animate-shimmer h-6 w-40 rounded mx-auto mt-4" />
        <div className="shimmer-skeleton animate-shimmer h-4 w-64 rounded mx-auto mt-2 delay-75" />
      </div>
    </div>
  );
}
