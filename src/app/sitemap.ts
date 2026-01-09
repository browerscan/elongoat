import type { MetadataRoute } from "next";

import { getClusterIndex, getPaaIndex } from "../lib/indexes";
import { getPublicEnv } from "../lib/env";

const env = getPublicEnv();
export const revalidate = 3600;

// Fact pages that always exist
const FACT_SLUGS = ["age", "children", "dob", "net-worth"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io").replace(
    /\/$/,
    "",
  );
  const [cluster, paa] = await Promise.all([getClusterIndex(), getPaaIndex()]);

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
      url: `${siteUrl}/writing`,
      lastModified: now,
      priority: 0.85,
      changeFrequency: "weekly",
    },
    {
      url: `${siteUrl}/tweets`,
      lastModified: now,
      priority: 0.85,
      changeFrequency: "daily",
    },
    {
      url: `${siteUrl}/videos`,
      lastModified: now,
      priority: 0.7,
      changeFrequency: "daily",
    },
    {
      url: `${siteUrl}/about`,
      lastModified: clusterUpdated,
      priority: 0.6,
      changeFrequency: "monthly",
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
  // Detail-heavy sitemaps are split into dedicated routes under /sitemaps/*.

  return items;
}
