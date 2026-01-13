import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getRecommendations } from "../../lib/recommendations";
import { getClusterIndex } from "../../lib/indexes";

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

export async function RecommendedContent() {
  const cluster = await getClusterIndex();

  const seedQuery = cluster.topics
    .slice()
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 4)
    .map((t) => t.topic)
    .join(" ");

  const recommendations = await getRecommendations({
    query: seedQuery || "Tesla SpaceX Starship AI",
    limitArticles: 8,
    limitTweets: 4,
    minLikes: 1000,
    minScore: 0.12,
  });

  return (
    <section className="glass-premium rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold text-white">Recommended</h2>
            <p className="mt-1 text-xs text-white/50">
              Related content seeded by top topics
            </p>
          </div>
        </div>
        <Link href="/discover" className="badge-x">
          Tune it <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
            Articles
          </div>
          <div className="mt-3 space-y-2">
            {recommendations.articles.slice(0, 6).map((a) => (
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
                <ArrowRight className="h-4 w-4 text-white/25 group-hover:text-white/60 transition-colors shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
            Tweets
          </div>
          <div className="mt-3 space-y-2">
            {recommendations.tweets.length ? (
              recommendations.tweets.slice(0, 4).map((t) => (
                <a
                  key={t.tweetId}
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-white/55">
                    <span>{formatDate(t.createdAt)}</span>
                    <span>❤️ {formatNumber(t.likeCount)}</span>
                  </div>
                  <div className="mt-2 text-sm text-white/80 line-clamp-3">
                    {t.text}
                  </div>
                </a>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                No tweet matches yet. (Tweets require the archive DB.)
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
