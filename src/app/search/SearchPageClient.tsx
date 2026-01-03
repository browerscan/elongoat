"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";

import { SearchInput } from "@/components/SearchInput";
import { SearchResults } from "@/components/SearchResults";
import type { SearchResponse } from "@/lib/types/search";

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
      <div className="glass rounded-3xl p-6">
        <h1 className="text-2xl font-semibold text-white">Search</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Search across all topics, keyword pages, Q&A, and videos.
        </p>
        <div className="mt-4">
          <SearchInput
            value={query}
            onChange={handleSearchChange}
            placeholder="Search topics, pages, Q&A, videos..."
            autoFocus
          />
        </div>
      </div>

      {query.length >= 2 || totalCount > 0 ? (
        <SearchResults
          results={results}
          totalCount={totalCount}
          isLoading={isLoading}
        />
      ) : (
        <div className="glass rounded-3xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <svg
              className="h-5 w-5 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white">Start searching</h3>
          <p className="mt-2 text-sm text-white/60">
            Enter at least 2 characters to search our content.
          </p>
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
      <div className="glass rounded-3xl p-6">
        <div className="h-7 w-20 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-white/5" />
        <div className="mt-4 h-10 w-full animate-pulse rounded-xl bg-white/5" />
      </div>
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
