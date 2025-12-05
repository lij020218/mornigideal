import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // instrumentationHook is now enabled by default in Next.js 15+
  experimental: {
    // Increase body size limit to 50MB for file uploads (Vercel Pro supports up to 4.5MB per serverless function, but we can handle larger files in chunks)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Note: In Next.js App Router, API route body size limits are handled in route.ts files
  // The 'api' config is deprecated in Next.js 13+

  // Turbopack config (Next.js 16+ default)
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Copy pdf.worker.js file to output directory
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
    }
    return config;
  },
};

export default nextConfig;
