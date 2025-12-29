import Link from "next/link";

import { ArrowRight, Sparkles } from "lucide-react";

import { FilterList, type FilterListItem } from "@/components/FilterList";
import { JsonLd } from "@/components/JsonLd";
import { OpenChatButton } from "@/components/OpenChatButton";
import {
  getClusterIndex,
  getPaaIndex,
  getTopPageSlugs,
  getTopQuestionSlugs,
} from "@/lib/indexes";
import { getDynamicVariables } from "@/lib/variables";
import { generateHomeMetadata } from "@/lib/seo";
import {
  generateOrganizationSchema,
  generatePersonSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
} from "@/lib/structuredData";

export const revalidate = 3600;

export const metadata = generateHomeMetadata();

export default async function Home() {
  const [cluster, paa, vars, topPageSlugs, topQuestionSlugs] =
    await Promise.all([
      getClusterIndex(),
      getPaaIndex(),
      getDynamicVariables(),
      getTopPageSlugs(),
      getTopQuestionSlugs(),
    ]);

  // JSON-LD structured data
  const jsonLd = [
    generateWebSiteSchema(),
    generateOrganizationSchema(),
    generatePersonSchema(),
    generateWebPageSchema({
      title: "ElonGoat — Digital Elon (AI)",
      description:
        "A sci-fi knowledge base + streaming AI chat inspired by Elon Musk (not affiliated). Browse 13 topic hubs and 569 keyword pages built from real search demand.",
      url: "/",
      dateModified: new Date(cluster.generatedAt).toISOString(),
      breadcrumbs: [{ name: "Home", url: "/" }],
    }),
  ];

  const topPages = new Map(cluster.pages.map((p) => [p.slug, p]));
  const topQuestions = new Map(paa.questions.map((q) => [q.slug, q]));

  const trendingPages: FilterListItem[] = topPageSlugs
    .map((slug) => topPages.get(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 12)
    .map((p) => ({
      id: p.slug,
      title: p.page,
      subtitle: p.topic,
      meta: `Volume peak: ${p.maxVolume.toLocaleString()} • Keywords: ${p.keywordCount.toLocaleString()}`,
      href: `/${p.topicSlug}/${p.pageSlug}`,
    }));

  const trendingQuestions: FilterListItem[] = topQuestionSlugs
    .map((slug) => topQuestions.get(slug))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .slice(0, 12)
    .map((q) => ({
      id: q.slug,
      title: q.question,
      subtitle:
        q.answer ?? "Open this question and ask the AI for a deeper answer.",
      meta: q.volume
        ? `Search volume: ${q.volume.toLocaleString()}`
        : undefined,
      href: `/q/${q.slug}`,
    }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-10">
        <section className="glass glow-ring relative overflow-hidden rounded-3xl p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.35),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.22),transparent_45%),radial-gradient(circle_at_60%_90%,rgba(236,72,153,0.18),transparent_55%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5" />
              The sci‑fi knowledge base + chat experience
            </div>

            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
              <span className="text-gradient">ElonGoat</span> — the most
              aggressive Elon Musk knowledge graph + AI chat.
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-sm text-white/65 md:text-base">
              Browse 13 topic hubs and 569 keyword pages built from real search
              demand, then open the chat to get a streaming answer grounded in
              this site.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/topics"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Explore topics <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/q"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Browse Q&A <ArrowRight className="h-4 w-4" />
              </Link>
              <OpenChatButton />
            </div>

            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              <Stat label="Elon age (auto)" value={`${vars.age}`} />
              <Stat
                label="Children (variable)"
                value={`${vars.children_count}`}
              />
              <Stat label="Net worth (variable)" value={vars.net_worth} />
            </dl>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card
            title="Keyword architecture"
            value={`${cluster.pages.length.toLocaleString()} pages`}
            subtitle="Built from clusters.csv"
          />
          <Card
            title="Topic hubs"
            value={`${cluster.topics.length.toLocaleString()} hubs`}
            subtitle="Pillar + sub pages"
          />
          <Card
            title="Q&A dataset"
            value={`${paa.questions.length.toLocaleString()} questions`}
            subtitle="People Also Ask"
          />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Trending pages
              </h2>
              <Link
                href="/topics"
                className="text-sm text-white/60 transition hover:text-white"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {trendingPages.map((p) => (
                <Link
                  key={p.id}
                  href={p.href}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="text-sm font-semibold text-white">
                    {p.title}
                  </div>
                  <div className="mt-1 text-xs text-white/60">{p.subtitle}</div>
                  {p.meta ? (
                    <div className="mt-2 text-[11px] text-white/45">
                      {p.meta}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                Top questions
              </h2>
              <Link
                href="/q"
                className="text-sm text-white/60 transition hover:text-white"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {trendingQuestions.map((q) => (
                <Link
                  key={q.id}
                  href={q.href}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="text-sm font-semibold text-white">
                    {q.title}
                  </div>
                  {q.subtitle ? (
                    <div className="mt-1 text-xs text-white/60">
                      {q.subtitle}
                    </div>
                  ) : null}
                  {q.meta ? (
                    <div className="mt-2 text-[11px] text-white/45">
                      {q.meta}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">
            Search everything
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Filter across the entire topic map and jump straight into a page.
          </p>
          <div className="mt-4">
            <FilterList
              placeholder="Search topics, pages, keywords…"
              items={[
                ...cluster.pages.slice(0, 400).map((p) => ({
                  id: p.slug,
                  title: p.page,
                  subtitle: p.topic,
                  meta: `Peak ${p.maxVolume.toLocaleString()} • ${p.keywordCount.toLocaleString()} kws`,
                  href: `/${p.topicSlug}/${p.pageSlug}`,
                })),
                ...paa.questions.slice(0, 120).map((q) => ({
                  id: `q:${q.slug}`,
                  title: q.question,
                  subtitle: "Q&A",
                  meta: q.volume
                    ? `Volume ${q.volume.toLocaleString()}`
                    : undefined,
                  href: `/q/${q.slug}`,
                })),
              ]}
            />
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Card({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="text-xs text-white/55">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/60">{subtitle}</div>
    </div>
  );
}
