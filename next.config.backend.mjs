/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memory optimization for development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 3,
  },

  // Standalone output for VPS Docker deployment
  output: "standalone",

  env: {
    NEXT_BUILD_TARGET: "backend",
  },

  // API routes enabled for backend
  experimental: {
    serverActions: {
      allowedOrigins: ["elongoat.io", "api.elongoat.io"],
    },
  },

  serverExternalPackages: ["drizzle-kit", "esbuild", "pg-native"],
};

export default nextConfig;
