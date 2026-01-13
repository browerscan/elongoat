import type { MetadataRoute } from "next";

import { listCustomQaSlugs } from "../../../lib/customQa";
import { getPaaIndex } from "../../../lib/indexes";
import { getPublicEnv } from "../../../lib/env";

const env = getPublicEnv();
export const revalidate = 3600;

/**
 * Calculate priority based on question search volume
 */
function calculatePriority(volume: number, maxVolume: number): number {
  if (maxVolume === 0) return 0.5;
  const volumeRatio = volume / maxVolume;
  // Scale from 0.4 to 0.8 based on volume
  const priority = 0.4 + volumeRatio * 0.4;
  return Math.round(priority * 100) / 100;
}

/**
 * Determine change frequency based on search volume
 */
function getChangeFrequency(
  volume: number,
): MetadataRoute.Sitemap[number]["changeFrequency"] {
  // High-volume questions may need more frequent updates
  if (volume > 5000) return "weekly";
  if (volume > 1000) return "monthly";
  return "yearly";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io").replace(
    /\/$/,
    "",
  );
  const [paa, customSlugs] = await Promise.all([
    getPaaIndex(),
    listCustomQaSlugs(5000),
  ]);
  const paaUpdated = new Date(paa.generatedAt);
  const now = new Date();

  // Calculate max volume for priority scaling
  const maxVolume = Math.max(...paa.questions.map((q) => q.volume), 1);

  const items: MetadataRoute.Sitemap = [];

  // Q&A pages with dynamic priority based on search volume
  for (const q of paa.questions) {
    const priority = calculatePriority(q.volume, maxVolume);
    const changeFrequency = getChangeFrequency(q.volume);

    items.push({
      url: `${siteUrl}/q/${q.slug}`,
      lastModified: paaUpdated,
      priority,
      changeFrequency,
    });
  }

  // Custom Q&A slugs (lower priority, dynamic update time)
  for (const slug of customSlugs) {
    items.push({
      url: `${siteUrl}/q/${slug}`,
      lastModified: now,
      priority: 0.5,
      changeFrequency: "monthly",
    });
  }

  return items;
}
