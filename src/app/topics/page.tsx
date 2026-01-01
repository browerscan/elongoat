import type { Metadata } from "next";

import Link from "next/link";

import { FilterList, type FilterListItem } from "@/components/FilterList";
import { JsonLd } from "@/components/JsonLd";
import { getClusterIndex } from "@/lib/indexes";
import {
  generateBreadcrumbSchema,
  generateWebPageSchema,
} from "@/lib/structuredData";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const cluster = await getClusterIndex();
  const topicCount = cluster.topics.length;
  const totalPages = cluster.pages.length;
  const totalVolume = cluster.topics.reduce((sum, t) => sum + t.totalVolume, 0);

  return {
    title: "Topics — Browse Elon Musk Knowledge Hubs",
    description: `Explore ${topicCount} topic hubs with ${totalPages.toLocaleString()} keyword pages about Elon Musk. Total search volume: ${totalVolume.toLocaleString()}. Covering Tesla, SpaceX, X/Twitter, and more.`,
    keywords: [
      "Elon Musk topics",
      "Tesla",
      "SpaceX",
      "topic hubs",
      "keyword research",
      "knowledge base",
    ],
    openGraph: {
      title: `Topics — ${topicCount} Hubs • ${totalPages.toLocaleString()} Pages`,
      description: `Browse ${topicCount} topic hubs about Elon Musk with ${totalPages.toLocaleString()} keyword pages. Total search volume: ${totalVolume.toLocaleString()}.`,
    },
  };
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
  ];

  const items: FilterListItem[] = cluster.topics.map((t) => ({
    id: t.slug,
    title: t.topic,
    subtitle: `${t.pageCount.toLocaleString()} pages`,
    meta: `Total volume (sum): ${t.totalVolume.toLocaleString()}`,
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
