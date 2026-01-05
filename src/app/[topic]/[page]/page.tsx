import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyPromptButton } from "../../../components/CopyPromptButton";
import { JsonLd } from "../../../components/JsonLd";
import { LastModified } from "../../../components/LastModified";
import { Markdown } from "../../../components/Markdown";
import { OpenChatButton } from "../../../components/OpenChatButton";
import { RelatedContent } from "../../../components/RelatedContent";
import { RelatedTweets } from "../../../components/RelatedTweets";
import { SeeAlso } from "../../../components/SeeAlso";
import { AuthorInfo } from "../../../components/AuthorInfo";
import { getClusterPageContent } from "../../../lib/contentGen";
import {
  findPage,
  getClusterIndex,
  getTopPageSlugs,
  listTopicPages,
} from "../../../lib/indexes";
import { generateClusterPageMetadata } from "../../../lib/seo";
import {
  generateArticleWithSpeakableSchema,
  generateBreadcrumbSchema,
  generateHowToSchema,
  generateWebPageSchema,
  extractHowToStepsFromMarkdown,
  isHowToContent,
} from "../../../lib/structuredData";
import { getDynamicVariables } from "../../../lib/variables";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getTopPageSlugs();
  return slugs.map((s) => {
    const [topic, page] = s.split("/");
    return { topic, page };
  });
}

export async function generateMetadata({
  params,
}: {
  params: { topic: string; page: string };
}): Promise<Metadata> {
  const page = await findPage(params.topic, params.page);
  if (!page)
    return {
      title: "Page not found",
      robots: { index: false },
    };

  return generateClusterPageMetadata({
    page: page.page,
    topic: page.topic,
    maxVolume: page.maxVolume,
    keywordCount: page.keywordCount,
    topicSlug: page.topicSlug,
    pageSlug: page.pageSlug,
  });
}

export default async function ClusterPage({
  params,
}: {
  params: { topic: string; page: string };
}) {
  const [page, vars, cluster] = await Promise.all([
    findPage(params.topic, params.page),
    getDynamicVariables(),
    getClusterIndex(),
  ]);
  if (!page) return notFound();

  const ai = await getClusterPageContent({
    topicSlug: params.topic,
    pageSlug: params.page,
  });

  const related = (await listTopicPages(page.topicSlug))
    .filter((p) => p.pageSlug !== page.pageSlug)
    .slice(0, 8);

  const keywords = `${page.page} ${page.topic} ${page.topKeywords
    .map((k) => k.keyword)
    .slice(0, 5)
    .join(" ")}`;

  const keywordsList = page.topKeywords.map((k) => k.keyword).slice(0, 10);
  const clusterUpdated = new Date(cluster.generatedAt);

  // Check if content is HowTo-style
  const contentIsHowTo = isHowToContent(ai.contentMd, page.page);
  const howToSteps = contentIsHowTo
    ? extractHowToStepsFromMarkdown(ai.contentMd)
    : [];

  // JSON-LD structured data
  const jsonLd: Record<string, unknown>[] = [
    generateWebPageSchema({
      title: `${page.page} — ${page.topic}`,
      description: `Explore "${page.page}" in ${page.topic}. ${page.keywordCount.toLocaleString()} related keywords with search intent analysis and AI chat.`,
      url: `/${page.topicSlug}/${page.pageSlug}`,
      dateModified: clusterUpdated.toISOString(),
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Topics", url: "/topics" },
        { name: page.topic, url: `/${page.topicSlug}` },
        { name: page.page, url: `/${page.topicSlug}/${page.pageSlug}` },
      ],
    }),
    // Use Article with Speakable for voice search optimization
    generateArticleWithSpeakableSchema({
      title: `${page.page} — ${page.topic}`,
      description: `Explore "${page.page}" in ${page.topic}. ${page.keywordCount.toLocaleString()} related keywords with search intent analysis and AI chat.`,
      url: `/${page.topicSlug}/${page.pageSlug}`,
      publishedAt: clusterUpdated.toISOString(),
      updatedAt: clusterUpdated.toISOString(),
      section: page.topic,
      keywords: [page.page, page.topic, ...keywordsList.slice(0, 3)],
      speakableSelectors: [
        "article h1",
        "article header p",
        "article section h2",
        "[data-speakable]",
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Topics", url: "/topics" },
      { name: page.topic, url: `/${page.topicSlug}` },
      { name: page.page, url: `/${page.topicSlug}/${page.pageSlug}` },
    ]),
  ];

  // Add HowTo schema if content has steps
  if (contentIsHowTo && howToSteps.length >= 2) {
    jsonLd.push(
      generateHowToSchema({
        name: page.page,
        description: `Step-by-step guide for ${page.page} in ${page.topic}`,
        url: `/${page.topicSlug}/${page.pageSlug}`,
        steps: howToSteps,
      }),
    );
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <article className="space-y-6">
        <header className="glass glow-ring rounded-3xl p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <Link href="/topics" className="hover:text-white">
              Topics
            </Link>
            <span className="text-white/30">/</span>
            <Link href={`/${page.topicSlug}`} className="hover:text-white">
              {page.topic}
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white/80">{page.page}</span>
          </div>

          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {page.page}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-white/65">
            This page is generated from search clusters. Use it as a launchpad:
            what people search for, how to interpret intent, and how to ask the
            AI the right follow-ups.
          </p>
          <LastModified date={clusterUpdated} className="mt-3" />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <OpenChatButton
              label="Ask the AI about this page"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            />
            <Link
              href={`/facts/age`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              Quick facts (age: {vars.age})
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Metric
            label="Keywords in cluster"
            value={page.keywordCount.toLocaleString()}
          />
          <Metric label="Content type" value={page.pageType ?? "General"} />
        </section>

        <section className="grid gap-6 md:grid-cols-5">
          <div className="glass rounded-3xl p-6 md:col-span-3">
            <h2 className="text-lg font-semibold text-white">
              Quick interpretation
            </h2>
            <div className="mt-3 space-y-3 text-sm text-white/70">
              <p>
                <span className="font-semibold text-white">Intent:</span>{" "}
                {inferIntent(page.topKeywords)}
              </p>
              <p>
                <span className="font-semibold text-white">
                  Why this matters:
                </span>{" "}
                this cluster captures real demand related to{" "}
                <span className="text-white">{page.topic}</span>. If you want
                the fastest answer, ask the AI a narrow question and include
                what you care about (timeframe, location, source preference).
              </p>
              <p className="text-white/55">
                Note: Any “net worth / live news” claims may be outdated. Use
                primary sources when accuracy matters.
              </p>
            </div>
          </div>

          <aside className="glass rounded-3xl p-6 md:col-span-2">
            <h2 className="text-lg font-semibold text-white">
              Ask better questions
            </h2>
            <div className="mt-3 space-y-2 text-sm text-white/70">
              <CopyPromptButton
                text={`Give me the 30‑second answer for “${page.page}”.`}
              />
              <CopyPromptButton
                text={`What changed in the last 30 days about “${page.page}”?`}
              />
              <CopyPromptButton
                text={`List primary sources to verify “${page.page}”.`}
              />
              <CopyPromptButton
                text={`Explain “${page.page}” like I'm technical, not a beginner.`}
              />
            </div>
            <div className="mt-4 text-xs text-white/50">
              Click a prompt to copy (chat widget will support paste).
            </div>
          </aside>
        </section>

        <section className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">
            Top searches inside this cluster
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Highest‑volume keywords tied to this page (capped to 20).
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {page.topKeywords.map((k) => (
              <div
                key={k.keyword}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-sm font-semibold text-white">
                  {k.keyword}
                </div>
                {k.intent ? (
                  <div className="mt-1 text-xs text-white/60">
                    Intent: {k.intent}
                  </div>
                ) : null}
                {k.serp_features ? (
                  <div className="mt-2 text-[11px] text-white/45">
                    {k.serp_features}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">AI brief</h2>
            <div className="text-xs text-white/50">
              Model: {ai.model}
              {ai.cached ? " • cached" : ""}
            </div>
          </div>
          <div className="mt-4">
            <Markdown content={ai.contentMd} />
          </div>
        </section>

        <AuthorInfo lastUpdated={clusterUpdated} contentType="cluster" />

        <section className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">
            More in {page.topic}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/${p.topicSlug}/${p.pageSlug}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="text-sm font-semibold text-white">{p.page}</div>
                <div className="mt-1 text-xs text-white/60">
                  {p.keywordCount.toLocaleString()} keywords
                </div>
              </Link>
            ))}
          </div>
        </section>

        <RelatedTweets
          keywords={[page.page, page.topic, ...keywordsList.slice(0, 3)]}
          limit={4}
          title="What Elon said about this"
        />

        <RelatedContent
          type="page"
          topicSlug={page.topicSlug}
          currentSlug={page.slug}
          pageTitle={page.page}
          keywords={keywordsList}
        />

        <SeeAlso
          type="page"
          keywords={keywords}
          topicSlug={page.topicSlug}
          currentSlug={page.slug}
        />
      </article>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function inferIntent(topKeywords: { intent?: string }[]) {
  const raw = topKeywords
    .map((k) => (k.intent ?? "").trim())
    .filter(Boolean)
    .flatMap((s) => s.split(",").map((p) => p.trim()))
    .filter(Boolean);
  if (!raw.length) return "Unknown / mixed";
  const counts = new Map<string, number>();
  for (const i of raw) counts.set(i, (counts.get(i) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted
    .slice(0, 3)
    .map(([k]) => k)
    .join(", ");
}
