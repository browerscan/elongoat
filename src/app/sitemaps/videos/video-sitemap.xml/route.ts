import { NextResponse } from "next/server";

import { listVideos } from "@/lib/videos";

export const revalidate = 3600;
export const dynamic = "force-static";

export async function GET() {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io"
  ).replace(/\/$/, "");
  const videos = await listVideos(5000);
  const now = new Date().toISOString();

  // Build XML with video namespace for Google Video Sitemap
  const xmlItems: string[] = [];

  // Video detail pages with <video:video> elements
  const seenVideos = new Set<string>();
  for (const v of videos) {
    if (seenVideos.has(v.videoId)) continue;
    seenVideos.add(v.videoId);

    const pageUrl = `${siteUrl}/videos/${v.videoId}`;
    const thumbnail =
      v.thumbnail ??
      `https://img.youtube.com/vi/${v.videoId}/maxresdefault.jpg`;
    const title = v.title ?? `Video ${v.videoId}`;
    const description =
      v.snippet ?? `${title}${v.channel ? ` from ${v.channel}` : ""}`;
    const lastMod = v.scrapedAt ? new Date(v.scrapedAt).toISOString() : now;

    xmlItems.push(`
  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <priority>0.5</priority>
    <video:video>
      <video:thumbnail_loc>${thumbnail}</video:thumbnail_loc>
      <video:title>${escapeXml(title)}</video:title>
      <video:description>${escapeXml(description.slice(0, 2048))}</video:description>
      <video:player_loc allow_embed="yes">https://www.youtube.com/embed/${v.videoId}</video:player_loc>
      ${v.duration ? `<video:duration>${parseDurationToSeconds(v.duration)}</video:duration>` : ""}
      ${v.publishedAt ? `<video:publication_date>${new Date(v.publishedAt).toISOString()}</video:publication_date>` : ""}
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${xmlItems.join("")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Parse ISO 8601 duration (PT4M32S) to seconds
 */
function parseDurationToSeconds(duration: string): number {
  // Handle ISO 8601 format (PT4M32S)
  const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] ?? "0", 10);
    const minutes = parseInt(isoMatch[2] ?? "0", 10);
    const seconds = parseInt(isoMatch[3] ?? "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Handle simple format like "4:32" or "1:04:32"
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  // Default to 0 if parsing fails
  return 0;
}
