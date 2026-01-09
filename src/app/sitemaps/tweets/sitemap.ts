import type { MetadataRoute } from "next";

import {
  getTweetStats,
  listTweetSitemapEntries,
} from "../../../lib/muskTweets";
import { getPublicEnv } from "../../../lib/env";

const env = getPublicEnv();
export const revalidate = 3600;

// Google recommends max 50,000 URLs per sitemap
const MAX_URLS_PER_SITEMAP = 45000;

/**
 * Generate sitemap index entries for tweet sitemaps
 */
export async function generateTweetSitemapIds(): Promise<number[]> {
  const stats = await getTweetStats();
  const total = stats?.totalTweets ?? 0;
  if (!total) return [];

  const numSitemaps = Math.ceil(total / MAX_URLS_PER_SITEMAP);
  return Array.from({ length: numSitemaps }, (_, i) => i);
}

export async function generateSitemaps() {
  const ids = await generateTweetSitemapIds();
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
  const offset = id * MAX_URLS_PER_SITEMAP;
  const now = new Date();

  const entries = await listTweetSitemapEntries({
    limit: MAX_URLS_PER_SITEMAP,
    offset,
  });

  return entries.map((entry) => {
    const parsed = new Date(entry.createdAt);
    const lastModified = Number.isNaN(parsed.getTime()) ? now : parsed;

    return {
      url: `${siteUrl}/tweets/${entry.tweetId}`,
      lastModified,
      priority: 0.5,
      changeFrequency: "yearly",
    };
  });
}
