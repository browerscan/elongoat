import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight, FileText, Search, BookOpen } from "lucide-react";

import { JsonLd } from "../../components/JsonLd";
import { listArticles, getArticleCount } from "../../lib/articles";
import { getTweetStats } from "../../lib/muskTweets";
import {
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateWebPageSchema,
} from "../../lib/structuredData";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Writing | ElonGoat",
  description:
    "Browse 570+ AI-generated long-form articles about Elon Musk, Tesla, SpaceX, and more. Deep analysis powered by RAG from 55K+ tweets.",
  alternates: { canonical: "/writing" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function WritingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const search = params.search || undefined;
  const limit = 24;
  const offset = (page - 1) * limit;

  const [articlesResult, articleCount, tweetStats] = await Promise.all([
    listArticles({ limit, offset, search, sort: "updated" }),
    getArticleCount(),
    getTweetStats(),
  ]);

  const { articles, pagination } = articlesResult;
  const totalPages = Math.ceil(pagination.total / limit);
  const totalTweets = tweetStats?.totalTweets?.toLocaleString() || "55K+";
  const pageDescription =
    articleCount > 0
      ? `Browse ${articleCount.toLocaleString()} AI-generated long-form articles built from ${totalTweets} tweets.`
      : "Browse AI-generated long-form articles built from Elon Musk's tweet archive.";

  const jsonLd = [
    generateWebPageSchema({
      title: "Writing — Elon Musk Long-Form Articles",
      description: pageDescription,
      url: "/writing",
      dateModified: articles[0]?.updatedAt,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Writing", url: "/writing" },
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Writing", url: "/writing" },
    ]),
    generateItemListSchema({
      name: "Elon Musk Articles",
      description: pageDescription,
      url: "/writing",
      items: articles.map((article) => ({
        name: article.title,
        url: article.url,
        description: article.snippet,
      })),
    }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-8">
        {/* Header */}
        <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                AI-Generated Content
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Writing
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                {articleCount.toLocaleString()} long-form articles generated
                from {totalTweets} tweets and curated sources. Each article is
                1,200+ words of deep analysis.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/tweets" className="btn-launch">
                <BookOpen className="h-4 w-4" />
                Browse Tweets
              </Link>
              <Link
                href="/x/search"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                <Search className="h-4 w-4" />
                Search
              </Link>
            </div>
          </div>

          {/* Search Form */}
          <form action="/writing" method="GET" className="mt-6 flex gap-3">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search articles (e.g., Tesla, SpaceX, AI)..."
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-premium rounded-3xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
              Total Articles
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {articleCount.toLocaleString()}
            </div>
          </div>
          <div className="glass-premium rounded-3xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
              Source Tweets
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {tweetStats?.totalTweets.toLocaleString() || "55K+"}
            </div>
          </div>
          <div className="glass-premium rounded-3xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
              Avg. Words
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">1,200+</div>
          </div>
        </div>

        {/* Articles Grid */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {search ? `Results for "${search}"` : "All Articles"}
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  {pagination.total.toLocaleString()} articles
                  {search && " matching your search"}
                </p>
              </div>
            </div>
          </div>

          {articles.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={article.url}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors line-clamp-2">
                    {article.title}
                  </div>
                  {article.snippet && (
                    <div className="mt-2 text-xs text-white/60 line-clamp-2">
                      {article.snippet}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/45">
                    <span>{formatDate(article.updatedAt)}</span>
                    <span>•</span>
                    <span>{article.wordCount.toLocaleString()} words</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm text-white/60">
                {search
                  ? `No articles found for "${search}". Try a different search term.`
                  : "No articles available. Check back soon!"}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/writing?page=${page - 1}${search ? `&search=${search}` : ""}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Previous
                </Link>
              )}
              <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/writing?page=${page + 1}${search ? `&search=${search}` : ""}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Quick Links */}
        <section className="glass-premium rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">Quick Links</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/tweets"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Browse Tweets <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
            <Link
              href="/x/archive"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Tweet Archive <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
            <Link
              href="/x/popular"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Popular Tweets <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
            <Link
              href="/x/search"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Search Tweets <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
