import Link from "next/link";
import { Brain, Globe, HelpCircle, Rocket, Sparkles, Zap } from "lucide-react";

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
      description: `Explore ${cluster.topics.length} topic hubs about Elon Musk — Tesla, SpaceX, X, Neuralink, AI and more.`,
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

  // Calculate total stats
  const totalPages = cluster.pages.length;
  const totalVolume = cluster.topics.reduce((sum, t) => sum + t.totalVolume, 0);

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        {/* Hero Header */}
        <header className="hero-cosmic glass-premium glow-ring rounded-3xl p-6 md:p-8">
          <div className="relative">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent3/20 bg-accent3/10 px-3 py-1 text-xs text-accent3">
                  <Brain className="h-3.5 w-3.5" />
                  Knowledge Map
                </div>
                <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                  <span className="text-gradient-bold">Topics</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                  Explore everything about Elon Musk — Tesla, SpaceX, X,
                  Neuralink, and more. Start with a topic hub, then dive deeper
                  into related articles.
                </p>
                <LastModified date={clusterUpdated} className="mt-4" />

                {/* Stats Row */}
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent3/10">
                      <Globe className="h-4 w-4 text-accent3" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {cluster.topics.length}
                      </div>
                      <div className="text-xs text-white/50">Topic Hubs</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                      <Rocket className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {totalPages.toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">Articles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent2/10">
                      <Zap className="h-4 w-4 text-accent2" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {(totalVolume / 1000000).toFixed(1)}M
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
                <Link href="/" className="badge-x">
                  <Globe className="h-3 w-3" />
                  Home
                </Link>
                <Link href="/q" className="badge-x">
                  <HelpCircle className="h-3 w-3" />
                  Q&A
                </Link>
                <Link href="/search" className="badge-x">
                  <Sparkles className="h-3 w-3" />
                  Search
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Search & Browse */}
        <section className="glass-premium rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent3/10">
              <Brain className="h-4 w-4 text-accent3" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                All Topic Hubs
              </h2>
              <p className="text-xs text-white/50">
                Search or browse the knowledge map
              </p>
            </div>
          </div>
          <FilterList
            items={items}
            placeholder="Search topics (Tesla stock, SpaceX missions…)…"
          />
        </section>
      </div>
    </>
  );
}
