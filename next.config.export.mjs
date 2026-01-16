/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memory optimization for development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 3,
  },

  // Static export for Cloudflare Pages
  output: "export",

  env: {
    NEXT_BUILD_TARGET: "export",
  },

  // Trailing slash can cause API export path conflicts; disable for static export.
  trailingSlash: false,

  // Images: unoptimized for static export (or use remote patterns)
  images: {
    unoptimized: true,
  },

  // Note: exportPathMap is not supported with the App Router.
};

export default nextConfig;
