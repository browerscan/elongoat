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
        crawlDelay: 1,
      },
      // Block aggressive AI scrapers (content protection)
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
      {
        userAgent: "ChatGPT-User",
        disallow: ["/"],
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
      },
      // Allow research-focused AI crawlers selectively
      // These may provide citation/attribution benefits
      {
        userAgent: ["anthropic-ai", "Claude-Web", "Claude-Search"],
        allow: ["/topics", "/q", "/facts"],
        disallow: ["/admin", "/api/", "/x", "/videos"],
      },
      // Google-specific directives
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
      {
        userAgent: "Google-Extended",
        disallow: ["/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
