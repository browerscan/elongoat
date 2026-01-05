import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight, FileText, HelpCircle, Search } from "lucide-react";

import {
  getClusterIndex,
  getPaaIndex,
  getTopPageSlugs,
  getTopQuestionSlugs,
} from "../../lib/indexes";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Browse long-form articles and Q&A about Elon Musk, powered by a knowledge graph and related-content recommendations.",
  alternates: { canonical: "/writing" },
};

export default async function WritingPage() {
  const [cluster, paa, topPageSlugs, topQuestionSlugs] = await Promise.all([
    getClusterIndex(),
    getPaaIndex(),
    getTopPageSlugs(),
    getTopQuestionSlugs(),
  ]);

  const pagesBySlug = new Map(cluster.pages.map((p) => [p.slug, p]));
  const questionsBySlug = new Map(paa.questions.map((q) => [q.slug, q]));

  const featuredPages = topPageSlugs
    .map((slug) => pagesBySlug.get(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 18);

  const featuredQuestions = topQuestionSlugs
    .map((slug) => questionsBySlug.get(slug))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .slice(0, 12);

  return (
    <div className="space-y-8">
      <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Articles • Q&A • Topics
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Writing
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
              Long-form pages generated from clusters (topics + keywords) and
              real questions people ask — designed for fast reading and easy
              discovery.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/discover" className="btn-launch">
              <Search className="h-4 w-4" />
              Discover
            </Link>
            <Link
              href="/topics"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              <FileText className="h-4 w-4" />
              Topics
            </Link>
          </div>
        </div>
      </header>

      <section className="glass-premium rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Featured articles
              </h2>
              <p className="mt-1 text-xs text-white/50">
                High-volume pages across the cluster index
              </p>
            </div>
          </div>
          <Link href="/topics" className="badge-x">
            Browse all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {featuredPages.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.topicSlug}/${p.pageSlug}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors line-clamp-2">
                {p.page}
              </div>
              <div className="mt-1 text-xs text-white/55">{p.topic}</div>
              <div className="mt-3 text-[11px] text-white/45">
                {p.keywordCount.toLocaleString()} keywords • max vol{" "}
                {p.maxVolume.toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="glass-premium rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-accent2" />
            <div>
              <h2 className="text-lg font-semibold text-white">Top Q&A</h2>
              <p className="mt-1 text-xs text-white/50">
                Popular questions from People Also Ask data
              </p>
            </div>
          </div>
          <Link href="/q" className="badge-x">
            All Q&A <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {featuredQuestions.map((q) => (
            <Link
              key={q.slug}
              href={`/q/${q.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="text-sm font-semibold text-white group-hover:text-accent2 transition-colors line-clamp-2">
                {q.question}
              </div>
              <div className="mt-1 text-xs text-white/55">Q&A</div>
              <div className="mt-3 text-[11px] text-white/45">
                volume {(q.volume ?? 0).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
