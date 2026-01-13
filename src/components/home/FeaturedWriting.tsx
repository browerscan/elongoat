import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchFeaturedArticles, fetchArticleCount } from "../../lib/apiClient";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function FeaturedWriting() {
  const [featuredResult, articleCount] = await Promise.all([
    fetchFeaturedArticles(8),
    fetchArticleCount(),
  ]);

  const featuredArticles = featuredResult.articles;

  return (
    <div className="glass-premium rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Featured writing</h2>
          <p className="mt-1 text-xs text-white/50">
            AI-generated articles from {articleCount.toLocaleString()} pieces
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
  );
}
