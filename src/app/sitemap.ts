import type { MetadataRoute } from "next";

import { listCustomQaSlugs } from "@/lib/customQa";
import { getClusterIndex, getPaaIndex } from "@/lib/indexes";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io"
  ).replace(/\/$/, "");
  const [cluster, paa, customSlugs] = await Promise.all([
    getClusterIndex(),
    getPaaIndex(),
    listCustomQaSlugs(5000),
  ]);

  const clusterUpdated = new Date(cluster.generatedAt);
  const paaUpdated = new Date(paa.generatedAt);
  const now = new Date();

  const items: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: clusterUpdated, priority: 1 },
    { url: `${siteUrl}/topics`, lastModified: clusterUpdated, priority: 0.9 },
    { url: `${siteUrl}/q`, lastModified: paaUpdated, priority: 0.9 },
    { url: `${siteUrl}/videos`, lastModified: clusterUpdated, priority: 0.6 },
    { url: `${siteUrl}/x`, lastModified: clusterUpdated, priority: 0.4 },
    {
      url: `${siteUrl}/x/following`,
      lastModified: clusterUpdated,
      priority: 0.3,
    },
    { url: `${siteUrl}/facts`, lastModified: clusterUpdated, priority: 0.5 },
  ];

  for (const t of cluster.topics) {
    items.push({
      url: `${siteUrl}/${t.slug}`,
      lastModified: clusterUpdated,
      priority: 0.8,
    });
  }

  for (const p of cluster.pages) {
    items.push({
      url: `${siteUrl}/${p.topicSlug}/${p.pageSlug}`,
      lastModified: clusterUpdated,
      priority: 0.6,
    });
  }

  for (const q of paa.questions) {
    items.push({
      url: `${siteUrl}/q/${q.slug}`,
      lastModified: paaUpdated,
      priority: 0.55,
    });
  }

  for (const slug of customSlugs) {
    items.push({
      url: `${siteUrl}/q/${slug}`,
      lastModified: now,
      priority: 0.55,
    });
  }

  return items;
}
