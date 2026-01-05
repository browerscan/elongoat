/**
 * RelatedTweets Component
 * Displays relevant tweets from Elon Musk based on page keywords
 * Used on article pages, Q&A pages, and topic pages
 */
import { findRelatedTweets, type MuskTweet } from "../lib/muskTweets";

interface RelatedTweetsProps {
  keywords: string[];
  limit?: number;
  title?: string;
}

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

function TweetCard({ tweet }: { tweet: MuskTweet }) {
  const tweetUrl =
    tweet.url ||
    tweet.twitterUrl ||
    `https://x.com/elonmusk/status/${tweet.tweetId}`;

  return (
    <a
      href={tweetUrl}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
    >
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          <svg
            className="h-5 w-5 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Elon Musk</span>
            <span className="text-sm text-white/50">@elonmusk</span>
            <span className="text-sm text-white/40">·</span>
            <span className="text-sm text-white/40">
              {formatDate(tweet.createdAt)}
            </span>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/80 line-clamp-4">
            {tweet.fullText}
          </p>

          <div className="mt-3 flex gap-4 text-xs text-white/50">
            {tweet.replyCount > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {formatNumber(tweet.replyCount)}
              </span>
            )}
            {tweet.retweetCount > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {formatNumber(tweet.retweetCount)}
              </span>
            )}
            {tweet.likeCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {formatNumber(tweet.likeCount)}
              </span>
            )}
            {tweet.viewCount > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {formatNumber(tweet.viewCount)}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

export async function RelatedTweets({
  keywords,
  limit = 3,
  title = "What Elon said about this",
}: RelatedTweetsProps) {
  if (keywords.length === 0) return null;

  const tweets = await findRelatedTweets({ keywords, limit });

  if (tweets.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <svg
          className="h-5 w-5 text-blue-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        {title}
      </h2>
      <div className="space-y-3">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.tweetId} tweet={tweet} />
        ))}
      </div>
      <div className="mt-3 text-center">
        <a
          href={`/x/search?q=${encodeURIComponent(keywords.slice(0, 3).join(" "))}`}
          className="text-sm text-white/50 hover:text-white/70"
        >
          Search more tweets →
        </a>
      </div>
    </section>
  );
}
