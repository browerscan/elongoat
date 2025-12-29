import type { Metadata } from "next";

import Link from "next/link";

import { FilterList, type FilterListItem } from "@/components/FilterList";
import { getClusterIndex } from "@/lib/indexes";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Topics",
  description: "Browse topic hubs and keyword pages about Elon Musk.",
};

export default async function TopicsIndexPage() {
  const cluster = await getClusterIndex();

  const items: FilterListItem[] = cluster.topics.map((t) => ({
    id: t.slug,
    title: t.topic,
    subtitle: `${t.pageCount.toLocaleString()} pages`,
    meta: `Total volume (sum): ${t.totalVolume.toLocaleString()}`,
    href: `/${t.slug}`,
  }));

  return (
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
  );
}
