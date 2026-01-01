/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memory optimization for development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 3,
  },

  // Static export for Cloudflare Pages
  output: "export",

  // Trailing slash for proper static hosting
  trailingSlash: true,

  // Images: unoptimized for static export (or use remote patterns)
  images: {
    unoptimized: true,
  },

  // Exclude API routes from static export
  // This regex matches all API routes
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId },
  ) {
    // Only export non-API routes
    const exportMap: Record<string, { page: string }> = {};
    for (const [path, page] of Object.entries(defaultPathMap)) {
      // Skip API routes entirely
      if (path.startsWith("/api/")) {
        continue;
      }
      // Skip dynamic pages that require runtime data
      if (path === "/search" || path.startsWith("/x/")) {
        continue;
      }
      exportMap[path] = page;
    }
    return exportMap;
  },
};

export default nextConfig;
