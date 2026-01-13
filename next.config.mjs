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
};

export default nextConfig;
