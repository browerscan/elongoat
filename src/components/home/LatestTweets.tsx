import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTimelineTweets } from "../../lib/muskTweets";

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

export async function LatestTweets() {
  const tweets = await getTimelineTweets({ limit: 6, includeReplies: false });

  return (
    <div className="glass-premium rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Latest tweets</h2>
          <p className="mt-1 text-xs text-white/50">
            From the local 2010–2025 archive
          </p>
        </div>
        <Link href="/tweets" className="badge-x">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-5 space-y-3">
        {tweets.length ? (
          tweets.map((t) => (
            <Link
              key={t.tweetId}
              href={`/tweets/${t.tweetId}`}
              className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/55">
                  {formatDate(t.createdAt)}
                </div>
                {t.likeCount > 0 ? (
                  <div className="text-xs text-white/45">
                    ❤️ {formatNumber(t.likeCount)}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-white/80 line-clamp-3">
                {t.fullText}
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No tweets found. If you want the archive, ingest `musk_tweets` into
            Postgres.
          </div>
        )}
      </div>
    </div>
  );
}
