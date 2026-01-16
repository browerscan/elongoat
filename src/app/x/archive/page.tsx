import type { Metadata } from "next";
import Link from "next/link";

import {
  getTimelineTweets,
  getTweetStats,
  getTweetCountsByYear,
} from "../../../lib/muskTweets";
import { IS_STATIC_EXPORT } from "../../../lib/staticExport";

export const revalidate = 3600; // 1 hour

export const metadata: Metadata = {
  title: "Elon Musk Tweet Archive (2010-2025) | ElonGoat",
  description:
    "Browse 67,000+ tweets from Elon Musk spanning 15 years (2010-2025). Search, filter, and explore his thoughts on Tesla, SpaceX, AI, and more.",
  alternates: { canonical: "/x/archive" },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
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

export default async function TweetArchivePage({
  searchParams,
}: {
  searchParams?: { year?: string; page?: string };
}) {
  const params = IS_STATIC_EXPORT ? {} : (searchParams ?? {});
  const year = params.year ? parseInt(params.year, 10) : undefined;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  const [tweets, stats, yearCounts] = await Promise.all([
    getTimelineTweets({ limit, offset, year }),
    getTweetStats(),
    getTweetCountsByYear(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Tweet Archive</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              {stats
                ? `${formatNumber(stats.totalTweets)} tweets from ${stats.earliestTweet.split("T")[0]} to ${stats.latestTweet.split("T")[0]}`
                : "Loading archive..."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/x"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Live Feed
            </Link>
            <Link
              href="/x/popular"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Most Popular
            </Link>
            <Link
              href="/x/search"
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Search
            </Link>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatNumber(stats.originalTweets)} original
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatNumber(stats.replies)} replies
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatNumber(stats.totalLikes)} total likes
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatNumber(stats.avgLikes)} avg likes
            </span>
          </div>
        )}
      </div>

      {/* Year Filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/x/archive"
          className={`rounded-xl px-3 py-2 text-sm transition ${
            !year
              ? "bg-white text-black font-semibold"
              : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          }`}
        >
          All Years
        </Link>
        {yearCounts.map((yc) => (
          <Link
            key={yc.year}
            href={`/x/archive?year=${yc.year}`}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              year === yc.year
                ? "bg-white text-black font-semibold"
                : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            {yc.year}{" "}
            <span className="text-white/50">({formatNumber(yc.count)})</span>
          </Link>
        ))}
      </div>

      {/* Tweet Grid */}
      {tweets.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {tweets.map((tweet) => (
            <a
              key={tweet.tweetId}
              href={
                tweet.url ||
                tweet.twitterUrl ||
                `https://x.com/elonmusk/status/${tweet.tweetId}`
              }
              target="_blank"
              rel="noreferrer"
              className="glass rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/55">
                  {formatDate(tweet.createdAt)}
                  {tweet.isReply && tweet.inReplyToUsername && (
                    <span className="ml-2 text-white/40">
                      → @{tweet.inReplyToUsername}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                {tweet.fullText}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/55">
                {tweet.likeCount > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    ❤️ {formatNumber(tweet.likeCount)}
                  </span>
                )}
                {tweet.retweetCount > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    🔄 {formatNumber(tweet.retweetCount)}
                  </span>
                )}
                {tweet.replyCount > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    💬 {formatNumber(tweet.replyCount)}
                  </span>
                )}
                {tweet.viewCount > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    👁 {formatNumber(tweet.viewCount)}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="glass rounded-3xl p-6 text-center">
          <p className="text-white/60">No tweets found for this filter.</p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        {page > 1 && (
          <Link
            href={`/x/archive?${year ? `year=${year}&` : ""}page=${page - 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            ← Previous
          </Link>
        )}
        <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
          Page {page}
        </span>
        {tweets.length === limit && (
          <Link
            href={`/x/archive?${year ? `year=${year}&` : ""}page=${page + 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
