import Link from "next/link";

import {
  ArrowRight,
  BookOpen,
  FileText,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

import { JsonLd } from "../components/JsonLd";
import { OpenChatButton } from "../components/OpenChatButton";
import { getClusterIndex } from "../lib/indexes";
import { getDynamicVariables } from "../lib/variables";
import { getFeaturedArticles, getArticleCount } from "../lib/articles";
import { generateHomeMetadata } from "../lib/seo";
import {
  generateOrganizationSchema,
  generatePersonSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
} from "../lib/structuredData";
import { getRecommendations } from "../lib/recommendations";
import { getTimelineTweets, getTweetStats } from "../lib/muskTweets";

export const revalidate = 3600;

export const metadata = generateHomeMetadata();

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

export default async function Home() {
  const [cluster, vars, featuredArticles, articleCount, tweetStats, tweets] =
    await Promise.all([
      getClusterIndex(),
      getDynamicVariables(),
      getFeaturedArticles(8),
      getArticleCount(),
      getTweetStats(),
      getTimelineTweets({ limit: 6, includeReplies: false }),
    ]);

  const jsonLd = [
    generateWebSiteSchema(),
    generateOrganizationSchema(),
    generatePersonSchema(),
    generateWebPageSchema({
      title: "Elon Musk (Unofficial) — ElonGoat",
      description:
        "An unofficial personal-style hub for Elon Musk: tweets, long-form articles, and related recommendations. Not affiliated.",
      url: "/",
      dateModified: new Date(cluster.generatedAt).toISOString(),
      breadcrumbs: [{ name: "Home", url: "/" }],
    }),
  ];

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
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-12">
        <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Unofficial • Not affiliated
              </div>
              <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Elon Musk
              </h1>
              <p className="mt-3 text-sm text-white/70 md:text-base">
                A personal-site style hub for tweets and long-form articles —
                with algorithmic related-content recommendations.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/about" className="btn-launch">
                  <UserRound className="h-4 w-4" />
                  About
                </Link>
                <Link
                  href="/writing"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <FileText className="h-4 w-4" />
                  Writing
                </Link>
                <Link
                  href="/tweets"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <BookOpen className="h-4 w-4" />
                  Tweets
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Link>
                <OpenChatButton />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5 ring-1 ring-white/10">
                <span className="text-sm font-semibold text-white/90">EM</span>
              </div>
              <div className="text-sm text-white/70">
                <div className="text-white/90 font-semibold">Snapshot</div>
                <div className="mt-1">
                  Age <span className="text-white/90">{vars.age}</span> • Net
                  worth <span className="text-white/90">{vars.net_worth}</span>
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {tweetStats?.totalTweets
                    ? `${tweetStats.totalTweets.toLocaleString()} archived tweets`
                    : "Tweets archive (DB optional)"}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Articles"
            value={articleCount.toLocaleString()}
            hint="AI-generated content"
          />
          <MetricCard
            label="Tweets"
            value={tweetStats?.totalTweets.toLocaleString() || "55K+"}
            hint="2010-2025 archive"
          />
          <MetricCard
            label="Topics"
            value={cluster.topics.length.toLocaleString()}
            hint="Knowledge graph hubs"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="glass-premium rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Latest tweets
                </h2>
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
                  No tweets found. If you want the archive, ingest `musk_tweets`
                  into Postgres.
                </div>
              )}
            </div>
          </div>

          <div className="glass-premium rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Featured writing
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  AI-generated articles from {articleCount.toLocaleString()}{" "}
                  pieces
                </p>
              </div>
              <Link href="/writing" className="badge-x">
                Browse <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {featuredArticles.length > 0 ? (
                featuredArticles.map((article) => (
                  <Link
                    key={article.slug}
                    href={article.url}
                    className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors line-clamp-2">
                      {article.title}
                    </div>
                    {article.snippet && (
                      <div className="mt-1 text-xs text-white/60 line-clamp-2">
                        {article.snippet}
                      </div>
                    )}
                    <div className="mt-3 text-[11px] text-white/45">
                      {formatDate(article.updatedAt)} •{" "}
                      {article.wordCount.toLocaleString()} words
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  No articles found. Check database connection.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Recommended
                </h2>
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
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-premium rounded-3xl p-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 text-sm text-white/55">{hint}</div>
    </div>
  );
}
