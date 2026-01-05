import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight, Search } from "lucide-react";

import { getTimelineTweets, getTweetStats } from "../../lib/muskTweets";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Tweets",
  description:
    "Browse Elon Musk tweets from the 2010–2025 archive and jump into related reading recommendations.",
  alternates: { canonical: "/tweets" },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TweetsPage() {
  const [stats, tweets] = await Promise.all([
    getTweetStats(),
    getTimelineTweets({ limit: 30, includeReplies: false }),
  ]);

  return (
    <div className="space-y-8">
      <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Archive (2010–2025)
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Tweets
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
              Read the archive and use the tweet detail pages to jump into
              related articles and questions.
            </p>

            {stats ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {stats.totalTweets.toLocaleString()} total
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {formatNumber(stats.originalTweets)} original
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {formatNumber(stats.totalLikes)} total likes
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/x/search" className="btn-launch">
              <Search className="h-4 w-4" />
              Search tweets
            </Link>
            <Link href="/x" className="badge-x">
              Live monitor <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <form action="/x/search" method="GET" className="mt-6 flex gap-3">
          <input
            type="text"
            name="q"
            placeholder="Search the archive (e.g., Starship, Tesla, AI)…"
            className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Search
          </button>
        </form>
      </header>

      {tweets.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {tweets.map((t) => (
            <Link
              key={t.tweetId}
              href={`/tweets/${t.tweetId}`}
              className="group block rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-white/55">
                <span>{formatDate(t.createdAt)}</span>
                {t.likeCount > 0 ? (
                  <span>❤️ {formatNumber(t.likeCount)}</span>
                ) : null}
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80 line-clamp-4">
                {t.fullText}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-premium rounded-3xl p-6 text-sm text-white/70">
          No tweets found. If you want tweet pages and recommendations, ingest
          the `musk_tweets` archive into Postgres.
        </div>
      )}
    </div>
  );
}
