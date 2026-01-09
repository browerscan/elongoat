import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";

import { JsonLd } from "../../../components/JsonLd";
import { extractKeywordsFromText } from "../../../lib/keywords";
import { getRecommendations } from "../../../lib/recommendations";
import { getTweetById } from "../../../lib/muskTweets";
import {
  generateBreadcrumbSchema,
  generateSocialMediaPostingSchema,
  generateWebPageSchema,
} from "../../../lib/structuredData";

export const revalidate = 3600;

function tweetUrl(tweetId: string): string {
  return `https://x.com/elonmusk/status/${encodeURIComponent(tweetId)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: { tweetId: string };
}): Promise<Metadata> {
  const tweet = await getTweetById(params.tweetId);
  if (!tweet) {
    return { title: "Tweet not found", robots: { index: false } };
  }

  const description = tweet.fullText.replace(/\s+/g, " ").slice(0, 160);

  return {
    title: `Tweet • ${formatDate(tweet.createdAt)}`,
    description,
    alternates: { canonical: `/tweets/${tweet.tweetId}` },
  };
}

export default async function TweetPage({
  params,
}: {
  params: { tweetId: string };
}) {
  const tweet = await getTweetById(params.tweetId);
  if (!tweet) return notFound();

  const keywords = extractKeywordsFromText(tweet.fullText, { max: 18 });
  const query = keywords.length ? keywords.join(" ") : tweet.fullText;
  const recs = await getRecommendations({
    query,
    keywords,
    limitArticles: 10,
    limitTweets: 10,
    minLikes: 500,
    minScore: 0.12,
  });

  const moreTweets = recs.tweets.filter((t) => t.tweetId !== tweet.tweetId);
  const pageTitle = `Tweet • ${formatDate(tweet.createdAt)}`;
  const pageDescription = tweet.fullText.replace(/\s+/g, " ").slice(0, 160);
  const pageUrl = `/tweets/${tweet.tweetId}`;

  const jsonLd = [
    generateWebPageSchema({
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      dateModified: tweet.createdAt,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Tweets", url: "/tweets" },
        { name: "Tweet", url: pageUrl },
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Tweets", url: "/tweets" },
      { name: "Tweet", url: pageUrl },
    ]),
    generateSocialMediaPostingSchema({
      text: tweet.fullText,
      url: pageUrl,
      sourceUrl: tweetUrl(tweet.tweetId),
      datePublished: tweet.createdAt,
      likeCount: tweet.likeCount,
      replyCount: tweet.replyCount,
      retweetCount: tweet.retweetCount,
      viewCount: tweet.viewCount,
    }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-8">
        <header className="glass-premium rounded-3xl p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs text-white/55">
                {formatDate(tweet.createdAt)}
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Tweet
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                {tweet.fullText}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                {tweet.likeCount > 0 ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    ❤️ {tweet.likeCount.toLocaleString()}
                  </span>
                ) : null}
                {tweet.retweetCount > 0 ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    🔄 {tweet.retweetCount.toLocaleString()}
                  </span>
                ) : null}
                {tweet.replyCount > 0 ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    💬 {tweet.replyCount.toLocaleString()}
                  </span>
                ) : null}
                {tweet.viewCount > 0 ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    👁 {tweet.viewCount.toLocaleString()}
                  </span>
                ) : null}
              </div>

              {keywords.length ? (
                <div className="mt-4 text-xs text-white/50">
                  Keywords: {keywords.slice(0, 12).join(", ")}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={tweetUrl(tweet.tweetId)}
                target="_blank"
                rel="noreferrer"
                className="badge-x"
              >
                View on X <ExternalLink className="h-3 w-3" />
              </a>
              <Link href="/tweets" className="badge-x">
                Back <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </header>

        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-white">
              Related reading
            </h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {recs.articles.length ? (
              recs.articles.slice(0, 8).map((a) => (
                <Link
                  key={a.url}
                  href={a.url}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
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
                </Link>
              ))
            ) : (
              <div className="text-sm text-white/60">
                No related content found.
              </div>
            )}
          </div>
        </section>

        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent2" />
            <h2 className="text-lg font-semibold text-white">More tweets</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {moreTweets.length ? (
              moreTweets.slice(0, 6).map((t) => (
                <a
                  key={t.tweetId}
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="text-xs text-white/55">
                    {new Date(t.createdAt).toLocaleDateString()} • ❤️{" "}
                    {t.likeCount.toLocaleString()}
                  </div>
                  <div className="mt-2 text-sm text-white/80 line-clamp-3">
                    {t.text}
                  </div>
                </a>
              ))
            ) : (
              <div className="text-sm text-white/60">
                No related tweets found.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
