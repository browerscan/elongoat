import type { Metadata } from "next";
import Link from "next/link";

import { searchTweets } from "../../../lib/muskTweets";

export const revalidate = 0; // Dynamic - no caching for search

export const metadata: Metadata = {
  title: "Search Elon Musk Tweets | ElonGoat",
  description:
    "Search through 67,000+ tweets from Elon Musk. Find his thoughts on any topic from 2010 to 2025.",
  alternates: { canonical: "/x/search" },
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

export default async function TweetSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; minLikes?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const minLikes = params.minLikes ? parseInt(params.minLikes, 10) : 0;

  const tweets = query
    ? await searchTweets({
        query,
        limit: 50,
        includeReplies: true,
        minLikes,
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              🔍 Search Tweets
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Search through 15 years of @elonmusk tweets (2010-2025)
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
              href="/x/popular"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Popular
            </Link>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <form action="/x/search" method="GET" className="flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search for tweets about Tesla, SpaceX, AI..."
          className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
        <select
          name="minLikes"
          defaultValue={minLikes.toString()}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
        >
          <option value="0">All likes</option>
          <option value="1000">1K+ likes</option>
          <option value="10000">10K+ likes</option>
          <option value="100000">100K+ likes</option>
          <option value="1000000">1M+ likes</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90"
        >
          Search
        </button>
      </form>

      {/* Popular Searches */}
      {!query && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-white/50">Popular:</span>
          {[
            "mars",
            "starship",
            "tesla",
            "AI",
            "twitter",
            "free speech",
            "spacex",
            "neuralink",
            "dogecoin",
            "future",
          ].map((term) => (
            <Link
              key={term}
              href={`/x/search?q=${encodeURIComponent(term)}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70 transition hover:bg-white/10"
            >
              {term}
            </Link>
          ))}
        </div>
      )}

      {/* Results */}
      {query && (
        <>
          <div className="text-sm text-white/60">
            Found {tweets.length} tweets matching &quot;{query}&quot;
            {minLikes > 0 && ` with ${formatNumber(minLikes)}+ likes`}
          </div>

          {tweets.length > 0 ? (
            <div className="space-y-3">
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
                  className="glass block rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/10"
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
                    <div className="text-xs text-white/40">
                      Relevance: {(tweet.rank * 100).toFixed(0)}%
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
              <p className="text-white/60">
                No tweets found. Try different keywords.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
