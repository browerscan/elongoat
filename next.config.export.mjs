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
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId },
  ) {
    // Filter out API routes from the path map
    const pathMap = {};
    for (const [path, page] of Object.entries(defaultPathMap)) {
      // Skip API routes
      if (!path.startsWith("/api/")) {
        pathMap[path] = page;
      }
    }
    return pathMap;
  },
};

export default nextConfig;
