"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Sparkles } from "lucide-react";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";

import { SearchInput } from "../../components/SearchInput";
import type { RecommendationResponse } from "../../lib/types/recommendations";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const SUGGESTIONS = [
  "Tesla deliveries",
  "Starship launch",
  "Mars colonization",
  "Neuralink FDA",
  "AI safety",
  "Dogecoin",
  "X / free speech",
];

function DiscoverInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    setQuery(q);

    if (q.length >= 2) {
      void fetchRecommendations(q);
    } else {
      setData(null);
      setError(null);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function fetchRecommendations(q: string) {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/recommendations?q=${encodeURIComponent(q)}&limitArticles=10&limitTweets=8&minLikes=500`,
        { signal: controller.signal },
      );

      if (requestId !== requestIdRef.current) return;

      const json = (await res.json()) as ApiResponse<RecommendationResponse>;
      if (!res.ok || !json.success) {
        setData(null);
        setError(
          json.success
            ? "Request failed"
            : json.error.message || "Request failed",
        );
        return;
      }

      setData(json.data);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setData(null);
      setError("Request failed");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  const handleQueryChange = (value: string) => {
    const next = value.trim();
    setQuery(value);

    if (next.length >= 2) {
      const params = new URLSearchParams();
      params.set("q", next);
      startTransition(() => {
        router.push(`/discover?${params.toString()}`);
      });
    } else if (next.length === 0) {
      startTransition(() => {
        router.push("/discover");
      });
    }
  };

  return (
    <div className="space-y-8">
      <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Recommendations
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Discover
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
              Type a topic and get related articles + tweets. This is a generic
              “for you” feed (not personalized).
            </p>

            <div className="mt-6">
              <SearchInput
                value={query}
                onChange={handleQueryChange}
                placeholder="Try: Starship, Tesla, AI, Mars..."
                autoFocus
                debounceMs={350}
              />
            </div>

            {!query && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-white/50">Try:</span>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleQueryChange(s)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/writing" className="badge-x">
              Writing
            </Link>
            <Link href="/tweets" className="badge-x">
              Tweets
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="glass-premium rounded-3xl p-6 text-sm text-white/70">
          {error}
        </div>
      ) : null}

      {isLoading ? <DiscoverSkeleton /> : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-premium rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-white">Articles</h2>
            </div>
            <div className="mt-5 space-y-2">
              {data.articles.length ? (
                data.articles.map((a) => (
                  <Link
                    key={a.url}
                    href={a.url}
                    className="group flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors line-clamp-2">
                        {a.title}
                      </div>
                      {a.snippet ? (
                        <div className="mt-1 text-xs text-white/60 line-clamp-2">
                          {a.snippet}
                        </div>
                      ) : null}
                      <div className="mt-2 text-[11px] text-white/45">
                        {a.source.replace("_", " ")} •{" "}
                        {Math.round(
                          Math.min(1, Math.max(0, a.relevance_score)) * 100,
                        )}
                        % match
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-sm text-white/60">No article matches.</div>
              )}
            </div>
          </section>

          <section className="glass-premium rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent2" />
              <h2 className="text-lg font-semibold text-white">Tweets</h2>
            </div>
            <div className="mt-5 space-y-2">
              {data.tweets.length ? (
                data.tweets.map((t) => (
                  <a
                    key={t.tweetId}
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="text-xs text-white/55">
                      ❤️ {t.likeCount.toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm text-white/80 line-clamp-3">
                      {t.text}
                    </div>
                    <div className="mt-2 text-[11px] text-white/45">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </a>
                ))
              ) : (
                <div className="text-sm text-white/60">
                  No tweet matches. (Tweets require the archive DB.)
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function DiscoverClient() {
  return (
    <Suspense fallback={<DiscoverSkeleton />}>
      <DiscoverInner />
    </Suspense>
  );
}

function DiscoverSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-premium rounded-3xl p-6">
        <div className="shimmer-skeleton animate-shimmer h-5 w-32 rounded mb-4" />
        <div className="space-y-3">
          <div className="shimmer-skeleton animate-shimmer h-20 rounded-2xl" />
          <div className="shimmer-skeleton animate-shimmer h-20 rounded-2xl delay-75" />
          <div className="shimmer-skeleton animate-shimmer h-20 rounded-2xl delay-150" />
        </div>
      </div>
      <div className="glass-premium rounded-3xl p-6">
        <div className="shimmer-skeleton animate-shimmer h-5 w-32 rounded mb-4" />
        <div className="space-y-3">
          <div className="shimmer-skeleton animate-shimmer h-20 rounded-2xl" />
          <div className="shimmer-skeleton animate-shimmer h-20 rounded-2xl delay-75" />
          <div className="shimmer-skeleton animate-shimmer h-20 rounded-2xl delay-150" />
        </div>
      </div>
    </div>
  );
}
