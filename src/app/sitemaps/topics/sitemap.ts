import type { MetadataRoute } from "next";

import { getClusterIndex } from "../../../lib/indexes";
import { getPublicEnv } from "../../../lib/env";

const env = getPublicEnv();
export const revalidate = 3600;

// Google recommends max 50,000 URLs per sitemap
const MAX_URLS_PER_SITEMAP = 45000;

/**
 * Calculate priority based on search volume
 * Higher volume = higher priority (0.3 to 1.0 range)
 */
function calculatePriority(
  volume: number,
  maxVolume: number,
  basePriority: number,
): number {
  if (maxVolume === 0) return basePriority;
  const volumeRatio = volume / maxVolume;
  return Math.min(1, basePriority + volumeRatio * 0.3);
}

/**
 * Determine change frequency based on content characteristics
 */
function getChangeFrequency(
  volume: number,
): MetadataRoute.Sitemap[number]["changeFrequency"] {
  // High-volume pages get more frequent crawl hints
  if (volume > 10000) return "weekly";
  if (volume > 1000) return "monthly";
  return "yearly";
}

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
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io").replace(
    /\/$/,
    "",
  );
  const cluster = await getClusterIndex();
  const clusterUpdated = new Date(cluster.generatedAt);

  // Calculate max volumes for priority scaling
  const maxTopicVolume = Math.max(
    ...cluster.topics.map((t) => t.totalVolume),
    1,
  );
  const maxPageVolume = Math.max(...cluster.pages.map((p) => p.maxVolume), 1);

  // Combine topics and pages into a single array for pagination
  const allItems: MetadataRoute.Sitemap = [];

  // Add topic hub pages first (higher priority, scaled by volume)
  for (const t of cluster.topics) {
    const priority = calculatePriority(t.totalVolume, maxTopicVolume, 0.7);
    const changeFrequency = getChangeFrequency(t.totalVolume);

    allItems.push({
      url: `${siteUrl}/${t.slug}`,
      lastModified: clusterUpdated,
      priority: Math.round(priority * 100) / 100,
      changeFrequency,
    });
  }

  // Add keyword pages under topics (priority based on search volume)
  for (const p of cluster.pages) {
    const priority = calculatePriority(p.maxVolume, maxPageVolume, 0.5);
    const changeFrequency = getChangeFrequency(p.maxVolume);

    allItems.push({
      url: `${siteUrl}/${p.topicSlug}/${p.pageSlug}`,
      lastModified: clusterUpdated,
      priority: Math.round(priority * 100) / 100,
      changeFrequency,
    });
  }

  // Calculate slice for this sitemap
  const start = id * MAX_URLS_PER_SITEMAP;
  const end = start + MAX_URLS_PER_SITEMAP;

  return allItems.slice(start, end);
}
