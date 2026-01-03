import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io";
  const baseUrl = siteUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/_next/", "/static/"],
        // No global crawlDelay - let major search engines crawl at their own pace
      },
      // Block aggressive AI scrapers (content protection)
      {
        userAgent: "GPTBot",
        disallow: ["/"],
        crawlDelay: 10,
      },
      {
        userAgent: "ChatGPT-User",
        disallow: ["/"],
        crawlDelay: 10,
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
        crawlDelay: 10,
      },
      // Allow research-focused AI crawlers selectively with rate limiting
      // These may provide citation/attribution benefits
      {
        userAgent: ["anthropic-ai", "Claude-Web", "Claude-Search"],
        allow: ["/topics", "/q", "/facts"],
        disallow: ["/admin", "/api/", "/x", "/videos"],
        crawlDelay: 5,
      },
      // Google-specific directives (no crawlDelay for Googlebot)
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
      {
        userAgent: "Google-Extended",
        disallow: ["/"],
      },
      // Bingbot - no crawlDelay needed
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
      // Other aggressive crawlers get throttled
      {
        userAgent: ["SemrushBot", "AhrefsBot", "DotBot", "MJ12bot"],
        crawlDelay: 5,
      },
    ],
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemaps/topics/sitemap.xml`,
      `${baseUrl}/sitemaps/qa/sitemap.xml`,
      `${baseUrl}/sitemaps/videos/sitemap.xml`,
      `${baseUrl}/sitemaps/videos/video-sitemap.xml`,
    ],
    host: baseUrl,
  };
}
