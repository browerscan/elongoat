import type { Metadata } from "next";

import Link from "next/link";

import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";

import { getClusterIndex } from "../../lib/indexes";
import { getTweetStats } from "../../lib/muskTweets";
import { getDynamicVariables } from "../../lib/variables";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "An unofficial personal-style hub for Elon Musk: tweets, long-form articles, and related recommendations. Not affiliated.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [vars, stats, cluster] = await Promise.all([
    getDynamicVariables(),
    getTweetStats(),
    getClusterIndex(),
  ]);

  const featuredNames = [
    "Tesla",
    "SpaceX",
    "X",
    "Neuralink",
    "The Boring Company",
    "xAI",
    "Starship",
    "Mars",
  ];

  const used = new Set<string>();
  const featuredTopics = featuredNames
    .map((name) => {
      const lower = name.toLowerCase();
      return (
        cluster.topics.find((t) => t.topic.toLowerCase() === lower) ??
        cluster.topics.find((t) => t.topic.toLowerCase().includes(lower))
      );
    })
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .filter((t) => (used.has(t.slug) ? false : (used.add(t.slug), true)))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <header className="hero-cosmic glass-premium rounded-3xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Unofficial • Not affiliated
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              About this site
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
              ElonGoat is a personal-site style hub to browse tweets, long-form
              articles, and Q&A — with “related content” recommendations to help
              you keep exploring.
            </p>
          </div>

          <a
            href="https://x.com/elonmusk"
            target="_blank"
            rel="noreferrer"
            className="badge-x"
          >
            Real profile <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard
          label="Age"
          value={String(vars.age)}
          hint="From dynamic facts"
          href="/facts/age"
        />
        <InfoCard
          label="Net worth"
          value={vars.net_worth}
          hint="From dynamic facts"
          href="/facts/net-worth"
        />
        <InfoCard
          label="Tweets"
          value={
            stats?.totalTweets
              ? stats.totalTweets.toLocaleString()
              : "DB optional"
          }
          hint="2010–2025 archive"
          href="/tweets"
        />
      </section>

      <section className="glass-premium rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Explore the universe
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Jump into the main topics and start reading
              </p>
            </div>
          </div>
          <Link href="/topics" className="badge-x">
            All topics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {featuredTopics.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="topic-card">
              <span className="text-sm font-medium text-white">{t.topic}</span>
              <span className="ml-auto text-xs text-white/50">
                {t.pageCount.toLocaleString()} pages
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="glass-premium rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-white">Disclaimer</h2>
        <p className="mt-2 text-sm text-white/70">
          This project is <span className="text-white/90">not affiliated</span>{" "}
          with Elon Musk or any of his companies. The AI chat is a simulation
          for information and entertainment.
        </p>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link href={href} className="glass-premium rounded-3xl p-6 group">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 text-sm text-white/55 group-hover:text-white/70 transition-colors">
        {hint}
      </div>
    </Link>
  );
}
