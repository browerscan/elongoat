/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memory optimization for development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 3,
  },

  // Standalone output for VPS Docker deployment
  output: "standalone",

  // API routes enabled for backend
  experimental: {
    serverActions: {
      allowedOrigins: ["elongoat.io", "api.elongoat.io"],
    },
  },
};

export default nextConfig;
