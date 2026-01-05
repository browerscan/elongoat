import type { Metadata } from "next";
import Link from "next/link";

import {
  getPopularTweets,
  getTweetCountsByYear,
} from "../../../lib/muskTweets";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Most Popular Elon Musk Tweets | ElonGoat",
  description:
    "The most liked and viral tweets from Elon Musk. Discover his most impactful posts about Tesla, SpaceX, AI, and life.",
  alternates: { canonical: "/x/popular" },
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

export default async function PopularTweetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; page?: string }>;
}) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year, 10) : undefined;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  const [tweets, yearCounts] = await Promise.all([
    getPopularTweets({ limit, offset, year }),
    getTweetCountsByYear(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              🔥 Most Popular Tweets
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              The most liked original tweets from @elonmusk, ranked by
              engagement.
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
              href="/x/archive"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Archive
            </Link>
            <Link
              href="/x/search"
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Search
            </Link>
          </div>
        </div>
      </div>

      {/* Year Filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/x/popular"
          className={`rounded-xl px-3 py-2 text-sm transition ${
            !year
              ? "bg-white text-black font-semibold"
              : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          }`}
        >
          All Time
        </Link>
        {yearCounts.slice(0, 10).map((yc) => (
          <Link
            key={yc.year}
            href={`/x/popular?year=${yc.year}`}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              year === yc.year
                ? "bg-white text-black font-semibold"
                : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            {yc.year}
          </Link>
        ))}
      </div>

      {/* Tweet List */}
      {tweets.length > 0 ? (
        <div className="space-y-3">
          {tweets.map((tweet, idx) => (
            <a
              key={tweet.tweetId}
              href={
                tweet.url ||
                tweet.twitterUrl ||
                `https://x.com/elonmusk/status/${tweet.tweetId}`
              }
              target="_blank"
              rel="noreferrer"
              className="glass flex gap-4 rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              {/* Rank */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white/70">
                {offset + idx + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-xs text-white/55">
                  {formatDate(tweet.createdAt)}
                </div>

                <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                  {tweet.fullText}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-red-300">
                    ❤️ {formatNumber(tweet.likeCount)}
                  </span>
                  {tweet.retweetCount > 0 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      🔄 {formatNumber(tweet.retweetCount)}
                    </span>
                  )}
                  {tweet.viewCount > 0 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      👁 {formatNumber(tweet.viewCount)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="glass rounded-3xl p-6 text-center">
          <p className="text-white/60">No tweets found.</p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        {page > 1 && (
          <Link
            href={`/x/popular?${year ? `year=${year}&` : ""}page=${page - 1}`}
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
            href={`/x/popular?${year ? `year=${year}&` : ""}page=${page + 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
