import Link from "next/link";

import { FilterList, type FilterListItem } from "../../components/FilterList";
import { JsonLd } from "../../components/JsonLd";
import { LastModified } from "../../components/LastModified";
import { getClusterIndex } from "../../lib/indexes";
import { generateTopicsIndexMetadata } from "../../lib/seo";
import {
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateWebPageSchema,
} from "../../lib/structuredData";

export const revalidate = 3600;

export async function generateMetadata() {
  const cluster = await getClusterIndex();
  const topicCount = cluster.topics.length;
  const totalPages = cluster.pages.length;
  const totalVolume = cluster.topics.reduce((sum, t) => sum + t.totalVolume, 0);

  return generateTopicsIndexMetadata({
    topicCount,
    totalPages,
    totalVolume,
  });
}

export default async function TopicsIndexPage() {
  const cluster = await getClusterIndex();

  // JSON-LD structured data
  const jsonLd = [
    generateWebPageSchema({
      title: "Topics — Browse Elon Musk Knowledge Hubs",
      description: `Explore ${cluster.topics.length} topic hubs with ${cluster.pages.length.toLocaleString()} keyword pages about Elon Musk.`,
      url: "/topics",
      dateModified: new Date(cluster.generatedAt).toISOString(),
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Topics", url: "/topics" },
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Topics", url: "/topics" },
    ]),
    // ItemList schema for better search appearance
    generateItemListSchema({
      name: "Elon Musk Topic Hubs",
      description: `Browse ${cluster.topics.length} topic hubs covering Tesla, SpaceX, X/Twitter, and more.`,
      url: "/topics",
      items: cluster.topics.slice(0, 50).map((t) => ({
        name: t.topic,
        url: `/${t.slug}`,
        description: `${t.pageCount} pages about ${t.topic}`,
      })),
      itemListOrder: "Descending",
    }),
  ];

  const clusterUpdated = new Date(cluster.generatedAt);

  const items: FilterListItem[] = cluster.topics.map((t) => ({
    id: t.slug,
    title: t.topic,
    subtitle: `${t.pageCount.toLocaleString()} pages`,
    meta: undefined,
    href: `/${t.slug}`,
  }));

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        <div className="glass rounded-3xl p-6">
          <h1 className="text-2xl font-semibold text-white">Topics</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Start at a hub, then drill down into the keyword pages. Everything
            here is generated from{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
              elon-musk_clusters.csv
            </code>
            .
          </p>
          <LastModified date={clusterUpdated} className="mt-3" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Back home
            </Link>
            <Link
              href="/q"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Browse Q&A
            </Link>
          </div>
        </div>

        <FilterList
          items={items}
          placeholder="Search topics (Tesla stock, SpaceX missions…)…"
        />
      </div>
    </>
  );
}
