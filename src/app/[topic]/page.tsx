import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Globe, Rocket, Sparkles, Zap } from "lucide-react";

import { FilterList, type FilterListItem } from "../../components/FilterList";
import { JsonLd } from "../../components/JsonLd";
import { LastModified } from "../../components/LastModified";
import { RelatedContent } from "../../components/RelatedContent";
import { SeeAlso } from "../../components/SeeAlso";
import { findTopic, getClusterIndex, listTopicPages } from "../../lib/indexes";
import { getSlugsWithAiContent } from "../../lib/contentCache";
import { generateTopicMetadata } from "../../lib/seo";
import {
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateProfilePageSchema,
  generateWebPageSchema,
} from "../../lib/structuredData";

export const revalidate = 3600;

export async function generateStaticParams() {
  const cluster = await getClusterIndex();
  return cluster.topics.map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { topic: string };
}): Promise<Metadata> {
  const topic = await findTopic(params.topic);
  if (!topic)
    return {
      title: "Topic not found",
      robots: { index: false },
    };
  return generateTopicMetadata({
    topic: topic.topic,
    topicSlug: topic.slug,
    pageCount: topic.pageCount,
    totalVolume: topic.totalVolume,
  });
}

export default async function TopicHubPage({
  params,
}: {
  params: { topic: string };
}) {
  const topic = await findTopic(params.topic);
  if (!topic) return notFound();

  const [pages, cluster, aiPageSlugs] = await Promise.all([
    listTopicPages(topic.slug),
    getClusterIndex(),
    getSlugsWithAiContent("cluster_page"),
  ]);

  const clusterUpdated = new Date(cluster.generatedAt);

  // JSON-LD structured data
  const jsonLd = [
    generateWebPageSchema({
      title: `${topic.topic} — Topic Hub`,
      description: `Browse ${topic.pageCount.toLocaleString()} pages in the "${topic.topic}" topic hub about Elon Musk.`,
      url: `/${topic.slug}`,
      dateModified: clusterUpdated.toISOString(),
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Topics", url: "/topics" },
        { name: topic.topic, url: `/${topic.slug}` },
      ],
    }),
    generateProfilePageSchema({
      topic: topic.topic,
      description: `Browse ${topic.pageCount.toLocaleString()} pages related to ${topic.topic}.`,
      url: `/${topic.slug}`,
      pageCount: topic.pageCount,
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Topics", url: "/topics" },
      { name: topic.topic, url: `/${topic.slug}` },
    ]),
    // ItemList schema for pages in this topic
    generateItemListSchema({
      name: `${topic.topic} Pages`,
      description: `Browse ${pages.length} pages about ${topic.topic}`,
      url: `/${topic.slug}`,
      items: pages.slice(0, 30).map((p) => ({
        name: p.page,
        url: `/${p.topicSlug}/${p.pageSlug}`,
        description: `Learn about ${p.page}`,
      })),
      itemListOrder: "Descending",
    }),
  ];

  // Sort pages: AI content first, then by keyword count
  const sortedPages = [...pages].sort((a, b) => {
    const aHasAi = aiPageSlugs.has(a.slug);
    const bHasAi = aiPageSlugs.has(b.slug);
    if (aHasAi && !bHasAi) return -1;
    if (!aHasAi && bHasAi) return 1;
    return b.keywordCount - a.keywordCount;
  });

  const items: FilterListItem[] = sortedPages.map((p) => ({
    id: p.slug,
    title: p.page,
    subtitle: undefined,
    meta: aiPageSlugs.has(p.slug) ? "AI Article" : undefined,
    href: `/${p.topicSlug}/${p.pageSlug}`,
  }));

  // Get count of AI articles
  const aiArticleCount = sortedPages.filter((p) =>
    aiPageSlugs.has(p.slug),
  ).length;

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        {/* Topic Hub Header */}
        <header className="hero-cosmic glass-premium glow-ring rounded-3xl p-6 md:p-8">
          <div className="relative">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs text-accent">
                  <Globe className="h-3.5 w-3.5" />
                  Topic Universe
                </div>
                <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                  <span className="text-gradient-bold">{topic.topic}</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                  Explore the complete knowledge graph for {topic.topic}.
                  Deep-dive into {topic.pageCount.toLocaleString()}{" "}
                  interconnected articles.
                </p>
                <LastModified date={clusterUpdated} className="mt-4" />

                {/* Stats Row */}
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                      <Rocket className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {topic.pageCount.toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">Articles</div>
                    </div>
                  </div>
                  {aiArticleCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent2/10">
                        <Sparkles className="h-4 w-4 text-accent2" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {aiArticleCount}
                        </div>
                        <div className="text-xs text-white/50">AI Articles</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent3/10">
                      <Zap className="h-4 w-4 text-accent3" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {topic.totalVolume.toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">
                        Monthly Searches
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Navigation */}
              <div className="flex flex-wrap gap-2 md:flex-col">
                <Link href="/topics" className="badge-x">
                  <Globe className="h-3 w-3" />
                  All Topics
                </Link>
                <Link href="/q" className="badge-x">
                  <Zap className="h-3 w-3" />
                  Q&A
                </Link>
                <Link href="/facts" className="badge-x">
                  <Sparkles className="h-3 w-3" />
                  Facts
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Search & Filter */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Search {topic.topic}
              </h2>
              <p className="text-xs text-white/50">
                Find specific articles in this topic
              </p>
            </div>
          </div>
          <FilterList
            items={items}
            placeholder={`What do you want to know about ${topic.topic}?`}
          />
        </section>

        <RelatedContent type="topic" topicSlug={topic.slug} />

        <SeeAlso type="page" keywords={topic.topic} topicSlug={topic.slug} />
      </div>
    </>
  );
}
