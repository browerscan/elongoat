import type { MetadataRoute } from "next";

import { listCustomQaSlugs } from "@/lib/customQa";
import { getPaaIndex } from "@/lib/indexes";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io"
  ).replace(/\/$/, "");
  const [paa, customSlugs] = await Promise.all([
    getPaaIndex(),
    listCustomQaSlugs(5000),
  ]);
  const paaUpdated = new Date(paa.generatedAt);
  const now = new Date();

  const items: MetadataRoute.Sitemap = [];

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

  return items;
}
