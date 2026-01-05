import Link from "next/link";

import {
  ArrowRight,
  BookOpen,
  Rocket,
  Sparkles,
  Zap,
  Brain,
  Globe,
} from "lucide-react";

import { FilterList, type FilterListItem } from "../components/FilterList";
import { JsonLd } from "../components/JsonLd";
import { OpenChatButton } from "../components/OpenChatButton";
import {
  getClusterIndex,
  getPaaIndex,
  getTopPageSlugs,
  getTopQuestionSlugs,
} from "../lib/indexes";
import { getDynamicVariables } from "../lib/variables";
import { getSlugsWithAiContent } from "../lib/contentCache";
import { generateHomeMetadata } from "../lib/seo";
import {
  generateOrganizationSchema,
  generatePersonSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
} from "../lib/structuredData";

export const revalidate = 3600;

export const metadata = generateHomeMetadata();

export default async function Home() {
  const [
    cluster,
    paa,
    vars,
    topPageSlugs,
    topQuestionSlugs,
    aiPageSlugs,
    aiQaSlugs,
  ] = await Promise.all([
    getClusterIndex(),
    getPaaIndex(),
    getDynamicVariables(),
    getTopPageSlugs(),
    getTopQuestionSlugs(),
    getSlugsWithAiContent("cluster_page"),
    getSlugsWithAiContent("paa_question"),
  ]);

  // JSON-LD structured data
  const jsonLd = [
    generateWebSiteSchema(),
    generateOrganizationSchema(),
    generatePersonSchema(),
    generateWebPageSchema({
      title: "ElonGoat — Digital Elon (AI)",
      description:
        "A sci-fi knowledge base + streaming AI chat inspired by Elon Musk (not affiliated). Explore Tesla, SpaceX, X, Neuralink and more — then ask the AI anything.",
      url: "/",
      dateModified: new Date(cluster.generatedAt).toISOString(),
      breadcrumbs: [{ name: "Home", url: "/" }],
    }),
  ];

  const topPages = new Map(cluster.pages.map((p) => [p.slug, p]));
  const topQuestions = new Map(paa.questions.map((q) => [q.slug, q]));

  // Prioritize pages with AI-generated content
  const pagesWithAi = topPageSlugs.filter((slug) => aiPageSlugs.has(slug));
  const pagesWithoutAi = topPageSlugs.filter((slug) => !aiPageSlugs.has(slug));
  const sortedPageSlugs = [...pagesWithAi, ...pagesWithoutAi];

  const trendingPages: (FilterListItem & { hasAi?: boolean })[] =
    sortedPageSlugs
      .map((slug) => topPages.get(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .slice(0, 12)
      .map((p) => ({
        id: p.slug,
        title: p.page,
        subtitle: p.topic,
        meta: aiPageSlugs.has(p.slug) ? "AI Article" : undefined,
        hasAi: aiPageSlugs.has(p.slug),
        href: `/${p.topicSlug}/${p.pageSlug}`,
      }));

  // Prioritize questions with AI-generated content
  const questionsWithAi = topQuestionSlugs.filter((slug) =>
    aiQaSlugs.has(slug),
  );
  const questionsWithoutAi = topQuestionSlugs.filter(
    (slug) => !aiQaSlugs.has(slug),
  );
  const sortedQuestionSlugs = [...questionsWithAi, ...questionsWithoutAi];

  const trendingQuestions: (FilterListItem & { hasAi?: boolean })[] =
    sortedQuestionSlugs
      .map((slug) => topQuestions.get(slug))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .slice(0, 12)
      .map((q) => ({
        id: q.slug,
        title: q.question,
        subtitle:
          q.answer ?? "Open this question and ask the AI for a deeper answer.",
        meta: aiQaSlugs.has(q.slug) ? "AI Answer" : undefined,
        hasAi: aiQaSlugs.has(q.slug),
        href: `/q/${q.slug}`,
      }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-10">
        {/* Hero Section - Elon's Vision */}
        <section className="hero-cosmic glass glow-ring rounded-3xl p-6 md:p-10">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent3/30 bg-accent3/10 px-3 py-1 text-xs text-accent3">
              <Rocket className="h-3.5 w-3.5" />
              The future is already here
            </div>

            <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              <span className="text-gradient-bold">ElonGoat</span>
              <span className="block mt-2 text-2xl md:text-3xl lg:text-4xl font-medium text-white/80">
                The most comprehensive Elon Musk knowledge graph
              </span>
            </h1>

            {/* Elon-style quote */}
            <div className="elon-quote mt-6 max-w-2xl">
              <p className="text-white/90">
                When something is important enough, you do it even if the odds
                are not in your favor.
              </p>
              <p className="mt-2 text-xs text-white/50 not-italic">
                — Elon Musk
              </p>
            </div>

            <p className="mission-statement mt-6 max-w-2xl">
              Explore the mind behind Tesla, SpaceX, X, Neuralink, and the
              mission to make humanity multi-planetary. Ask the AI anything —
              get answers backed by 67K+ real tweets.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/topics" className="btn-launch">
                <Rocket className="h-4 w-4" />
                Explore the Universe
              </Link>
              <Link
                href="/q"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                <Brain className="h-4 w-4" />
                Ask Questions
              </Link>
              <OpenChatButton />
            </div>

            {/* Live Stats - First Principles Numbers */}
            <div className="accent-line mt-8 w-24" />
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <Link href="/facts/age" className="stat-card group">
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <Zap className="h-3 w-3 text-accent3" />
                  Age
                </div>
                <div className="stat-card-value mt-2">{vars.age}</div>
                <div className="mt-1 text-xs text-white/40 group-hover:text-white/60 transition-colors">
                  years of innovation
                </div>
              </Link>
              <Link href="/facts/children" className="stat-card group">
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <Globe className="h-3 w-3 text-accent2" />
                  Children
                </div>
                <div className="stat-card-value mt-2">
                  {vars.children_count}
                </div>
                <div className="mt-1 text-xs text-white/40 group-hover:text-white/60 transition-colors">
                  future Martians
                </div>
              </Link>
              <Link href="/facts/net-worth" className="stat-card group">
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <Sparkles className="h-3 w-3 text-accent" />
                  Net Worth
                </div>
                <div className="stat-card-value mt-2">{vars.net_worth}</div>
                <div className="mt-1 text-xs text-white/40 group-hover:text-white/60 transition-colors">
                  invested in the future
                </div>
              </Link>
            </dl>
          </div>
        </section>

        {/* Knowledge Scale - The Numbers */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card
            title="Knowledge Nodes"
            value={`${cluster.pages.length.toLocaleString()}`}
            subtitle="Deep-dive articles on Tesla, SpaceX, X, AI & the future"
            icon={<Brain className="h-5 w-5 text-accent" />}
          />
          <Card
            title="Topic Universes"
            value={`${cluster.topics.length.toLocaleString()}`}
            subtitle="Interconnected hubs — like neurons in a giant brain"
            icon={<Globe className="h-5 w-5 text-accent2" />}
          />
          <Card
            title="Questions Answered"
            value={`${paa.questions.length.toLocaleString()}`}
            subtitle="Real questions from people curious about the future"
            icon={<Zap className="h-5 w-5 text-accent3" />}
          />
        </section>

        {/* Topic Universes - The Knowledge Map */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <Globe className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Topic Universes
                </h2>
                <p className="text-xs text-white/50">
                  Navigate the knowledge graph
                </p>
              </div>
            </div>
            <Link href="/topics" className="badge-x">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {cluster.topics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/${topic.slug}`}
                className="topic-card group"
              >
                <span className="text-sm font-medium text-white group-hover:text-accent transition-colors">
                  {topic.topic}
                </span>
                <span className="ml-auto text-xs text-white/40 group-hover:text-white/60 transition-colors">
                  {topic.pageCount} pages
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick Facts - Real-Time Data */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent2/10">
                <BookOpen className="h-5 w-5 text-accent2" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Real-Time Facts
                </h2>
                <p className="text-xs text-white/50">
                  Data that updates automatically
                </p>
              </div>
            </div>
            <Link href="/facts" className="badge-x">
              All facts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Link href="/facts/age" className="stat-card group">
              <div className="text-xs text-white/55">Current Age</div>
              <div className="stat-card-value mt-2">{vars.age}</div>
              <div className="mt-2 text-xs text-white/40 group-hover:text-accent2 transition-colors">
                Born June 28, 1971
              </div>
            </Link>
            <Link href="/facts/children" className="stat-card group">
              <div className="text-xs text-white/55">Children</div>
              <div className="stat-card-value mt-2">{vars.children_count}</div>
              <div className="mt-2 text-xs text-white/40 group-hover:text-accent2 transition-colors">
                The next generation
              </div>
            </Link>
            <Link href="/facts/dob" className="stat-card group">
              <div className="text-xs text-white/55">Date of Birth</div>
              <div className="stat-card-value mt-2 text-lg">{vars.dob}</div>
              <div className="mt-2 text-xs text-white/40 group-hover:text-accent2 transition-colors">
                Pretoria, South Africa
              </div>
            </Link>
            <Link href="/facts/net-worth" className="stat-card group">
              <div className="text-xs text-white/55">Net Worth</div>
              <div className="stat-card-value mt-2">{vars.net_worth}</div>
              <div className="mt-2 text-xs text-white/40 group-hover:text-accent2 transition-colors">
                Building the future
              </div>
            </Link>
          </div>
        </section>

        {/* Featured Q&A - What People Ask */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent3/10">
                <Brain className="h-5 w-5 text-accent3" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  What People Ask
                </h2>
                <p className="text-xs text-white/50">
                  Curiosity-driven knowledge
                </p>
              </div>
            </div>
            <Link href="/q" className="badge-x">
              All Q&A <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {trendingQuestions.slice(0, 6).map((q) => (
              <Link key={q.id} href={q.href} className="knowledge-node group">
                <div className="text-sm font-medium text-white group-hover:text-accent transition-colors line-clamp-2">
                  {q.title}
                </div>
                {q.meta ? (
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-accent2">
                    <Sparkles className="h-3 w-3" />
                    {q.meta}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        </section>

        {/* Dual Column - Trending & Questions */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="glass-premium rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-accent3" />
                <h2 className="text-lg font-semibold text-white">
                  Trending Now
                </h2>
              </div>
              <Link
                href="/topics"
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {trendingPages.map((p, i) => (
                <Link
                  key={p.id}
                  href={p.href}
                  className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 p-3 transition hover:border-accent/30 hover:bg-white/8"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-white/40 group-hover:bg-accent/20 group-hover:text-accent transition-colors">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-accent transition-colors truncate">
                      {p.title}
                    </div>
                    <div className="text-xs text-white/40">{p.subtitle}</div>
                  </div>
                  {p.meta && (
                    <span className="badge-ai shrink-0">{p.meta}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-premium rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent2" />
                <h2 className="text-lg font-semibold text-white">
                  Top Questions
                </h2>
              </div>
              <Link
                href="/q"
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {trendingQuestions.map((q, i) => (
                <Link
                  key={q.id}
                  href={q.href}
                  className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/3 p-3 transition hover:border-accent2/30 hover:bg-white/8"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-white/40 group-hover:bg-accent2/20 group-hover:text-accent2 transition-colors shrink-0">
                    ?
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-accent2 transition-colors line-clamp-2">
                      {q.title}
                    </div>
                    {q.meta && (
                      <span className="mt-1 inline-block badge-ai">
                        {q.meta}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Global Search - Command Center */}
        <section className="glass-premium glow-ring rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Search the Knowledge Graph
              </h2>
              <p className="text-xs text-white/50">
                Instant access to {cluster.pages.length.toLocaleString()}{" "}
                articles & {paa.questions.length.toLocaleString()} answers
              </p>
            </div>
          </div>
          <FilterList
            placeholder="What do you want to know about Elon Musk?"
            items={[
              ...cluster.pages.slice(0, 400).map((p) => ({
                id: p.slug,
                title: p.page,
                subtitle: p.topic,
                meta: undefined,
                href: `/${p.topicSlug}/${p.pageSlug}`,
              })),
              ...paa.questions.slice(0, 120).map((q) => ({
                id: `q:${q.slug}`,
                title: q.question,
                subtitle: "Q&A",
                meta: undefined,
                href: `/q/${q.slug}`,
              })),
            ]}
          />
        </section>
      </div>
    </>
  );
}

function Card({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-premium rounded-3xl p-6 group hover:glow-accent transition-all duration-300">
      <div className="flex items-center gap-2 text-xs text-white/55">
        {icon}
        {title}
      </div>
      <div className="stat-card-value mt-3">{value}</div>
      <div className="mt-2 text-sm text-white/50 group-hover:text-white/70 transition-colors">
        {subtitle}
      </div>
    </div>
  );
}
