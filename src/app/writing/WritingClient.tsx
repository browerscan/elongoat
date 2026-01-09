"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, FileText, Search, BookOpen, Loader2 } from "lucide-react";

type Article = {
  slug: string;
  kind: string;
  title: string;
  snippet: string;
  wordCount: number;
  updatedAt: string;
  generatedAt: string;
  url: string;
};

type ArticleListResponse = {
  articles: Article[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.elongoat.io";

export function WritingClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const search = searchParams.get("search") || "";
  const limit = 24;
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(pagination.total / limit);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", limit.toString());
        params.set("offset", offset.toString());
        params.set("sort", "updated");
        if (search) params.set("search", search);

        const res = await fetch(`${API_URL}/api/articles?${params}`);
        if (res.ok) {
          const data: ArticleListResponse = await res.json();
          setArticles(data.articles);
          setPagination({
            total: data.pagination.total,
            hasMore: data.pagination.hasMore,
          });
        }
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [page, search, offset]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchInput) params.set("search", searchInput);
    router.push(`/writing${params.toString() ? `?${params}` : ""}`);
  };

  return (
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
              {pagination.total.toLocaleString()} long-form articles generated
              from 55K+ tweets and curated sources. Each article is 1,200+ words
              of deep analysis.
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
        <form onSubmit={handleSearch} className="mt-6 flex gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
            {pagination.total.toLocaleString()}
          </div>
        </div>
        <div className="glass-premium rounded-3xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
            Source Tweets
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">55K+</div>
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

        {loading ? (
          <div className="mt-8 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        ) : articles.length > 0 ? (
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
  );
}
