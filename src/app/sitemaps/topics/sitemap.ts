import type { MetadataRoute } from "next";

import { getClusterIndex } from "@/lib/indexes";

export const revalidate = 3600;

// Google recommends max 50,000 URLs per sitemap
const MAX_URLS_PER_SITEMAP = 45000;

/**
 * Generate sitemap index entries for topic sitemaps
 * This function is called by the sitemap index generator
 */
export async function generateTopicSitemapIds(): Promise<number[]> {
  const cluster = await getClusterIndex();
  // Calculate total URLs: topics + pages
  const totalUrls = cluster.topics.length + cluster.pages.length;
  const numSitemaps = Math.ceil(totalUrls / MAX_URLS_PER_SITEMAP);
  return Array.from({ length: numSitemaps }, (_, i) => i);
}

export async function generateSitemaps() {
  const ids = await generateTopicSitemapIds();
  return ids.map((id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io"
  ).replace(/\/$/, "");
  const cluster = await getClusterIndex();
  const clusterUpdated = new Date(cluster.generatedAt);

  // Combine topics and pages into a single array for pagination
  const allItems: MetadataRoute.Sitemap = [];

  // Add topic hub pages first (higher priority)
  for (const t of cluster.topics) {
    allItems.push({
      url: `${siteUrl}/${t.slug}`,
      lastModified: clusterUpdated,
      priority: 0.8,
      changeFrequency: "weekly",
    });
  }

  // Add keyword pages under topics
  for (const p of cluster.pages) {
    allItems.push({
      url: `${siteUrl}/${p.topicSlug}/${p.pageSlug}`,
      lastModified: clusterUpdated,
      priority: 0.6,
      changeFrequency: "monthly",
    });
  }

  // Calculate slice for this sitemap
  const start = id * MAX_URLS_PER_SITEMAP;
  const end = start + MAX_URLS_PER_SITEMAP;

  return allItems.slice(start, end);
}
