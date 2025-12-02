import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentationHook is now enabled by default in Next.js 15+
  experimental: {
    // Increase body size limit to 50MB for file uploads (Vercel Pro supports up to 4.5MB per serverless function, but we can handle larger files in chunks)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // API route body size limit
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default nextConfig;
