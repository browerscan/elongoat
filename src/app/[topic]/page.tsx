import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

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
        description: `${p.keywordCount} related keywords`,
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
    subtitle: p.seedKeyword ? `Seed: ${p.seedKeyword}` : undefined,
    meta: aiPageSlugs.has(p.slug) ? "AI Article" : undefined,
    href: `/${p.topicSlug}/${p.pageSlug}`,
  }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        <div className="glass rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="text-xs text-white/55">Topic hub</div>
              <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight text-white">
                {topic.topic}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                {topic.pageCount.toLocaleString()} pages in this topic hub
              </p>
              <LastModified date={clusterUpdated} className="mt-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/topics"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                All topics
              </Link>
              <Link
                href="/q"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Q&A
              </Link>
              <Link
                href="/facts"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Facts
              </Link>
            </div>
          </div>
        </div>

        <FilterList
          items={items}
          placeholder={`Search inside "${topic.topic}"…`}
        />

        <RelatedContent type="topic" topicSlug={topic.slug} />

        <SeeAlso type="page" keywords={topic.topic} topicSlug={topic.slug} />
      </div>
    </>
  );
}
