import type { MetadataRoute } from "next";

import { listVideos } from "../../../lib/videos";
import { getPublicEnv } from "../../../lib/env";

const env = getPublicEnv();
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io").replace(
    /\/$/,
    "",
  );
  const videos = await listVideos(5000);
  const now = new Date();

  const items: MetadataRoute.Sitemap = [];

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

  return items;
}
