import type { MetadataRoute } from "next";

import { listCustomQaSlugs } from "@/lib/customQa";
import { getClusterIndex, getPaaIndex } from "@/lib/indexes";
import { listVideos } from "@/lib/videos";

export const revalidate = 3600;

// Fact pages that always exist
const FACT_SLUGS = ["age", "children", "dob", "net-worth"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io"
  ).replace(/\/$/, "");
  const [cluster, paa, customSlugs, videos] = await Promise.all([
    getClusterIndex(),
    getPaaIndex(),
    listCustomQaSlugs(5000),
    listVideos(5000),
  ]);

  const clusterUpdated = new Date(cluster.generatedAt);
  const paaUpdated = new Date(paa.generatedAt);
  const now = new Date();

  const items: MetadataRoute.Sitemap = [
    // Core pages
    {
      url: `${siteUrl}/`,
      lastModified: clusterUpdated,
      priority: 1,
      changeFrequency: "weekly",
    },
    {
      url: `${siteUrl}/topics`,
      lastModified: clusterUpdated,
      priority: 0.9,
      changeFrequency: "weekly",
    },
    {
      url: `${siteUrl}/q`,
      lastModified: paaUpdated,
      priority: 0.9,
      changeFrequency: "daily",
    },
    {
      url: `${siteUrl}/videos`,
      lastModified: now,
      priority: 0.7,
      changeFrequency: "daily",
    },
    {
      url: `${siteUrl}/x`,
      lastModified: now,
      priority: 0.5,
      changeFrequency: "hourly",
    },
    {
      url: `${siteUrl}/x/following`,
      lastModified: now,
      priority: 0.4,
      changeFrequency: "daily",
    },
    {
      url: `${siteUrl}/facts`,
      lastModified: now,
      priority: 0.6,
      changeFrequency: "weekly",
    },
    // Fact pages
    ...FACT_SLUGS.map((slug) => ({
      url: `${siteUrl}/facts/${slug}`,
      lastModified: now,
      priority: 0.55,
      changeFrequency: "weekly" as const,
    })),
  ];

  // Topic hub pages
  for (const t of cluster.topics) {
    items.push({
      url: `${siteUrl}/${t.slug}`,
      lastModified: clusterUpdated,
      priority: 0.8,
      changeFrequency: "weekly",
    });
  }

  // Keyword pages under topics
  for (const p of cluster.pages) {
    items.push({
      url: `${siteUrl}/${p.topicSlug}/${p.pageSlug}`,
      lastModified: clusterUpdated,
      priority: 0.6,
      changeFrequency: "monthly",
    });
  }

  // Q&A pages
  for (const q of paa.questions) {
    items.push({
      url: `${siteUrl}/q/${q.slug}`,
      lastModified: paaUpdated,
      priority: 0.55,
      changeFrequency: "monthly",
    });
  }

  // Custom Q&A slugs
  for (const slug of customSlugs) {
    items.push({
      url: `${siteUrl}/q/${slug}`,
      lastModified: now,
      priority: 0.55,
      changeFrequency: "monthly",
    });
  }

  // Video detail pages (only add unique videoIds)
  const seenVideos = new Set<string>();
  for (const v of videos) {
    if (seenVideos.has(v.videoId)) continue;
    seenVideos.add(v.videoId);

    items.push({
      url: `${siteUrl}/videos/${v.videoId}`,
      lastModified: v.scrapedAt ? new Date(v.scrapedAt) : now,
      priority: 0.5,
      changeFrequency: "monthly",
    });
  }

  // Note: If sitemap exceeds 50,000 URLs, Next.js will automatically
  // return a sitemap index. For large sites, consider splitting into
  // multiple sitemaps: sitemap-topics.xml, sitemap-qa.xml, etc.

  return items;
}
