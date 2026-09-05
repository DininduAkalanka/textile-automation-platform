import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for Docker only; Vercel requires native serverless output.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    unoptimized: true,
    dangerouslyAllowLocalIP: true,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "thilakawardhana.com",
      },
      {
        protocol: "https",
        hostname: "**.onrender.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "http",
        hostname: "backend",
      },
      {
        protocol: "http",
        hostname: "textile_backend",
      },
    ],
  },
  async rewrites() {
    let backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
      (process.env.VERCEL || process.env.NODE_ENV === 'production'
        ? 'https://textile-automation-platform.onrender.com'
        : 'http://backend:3001');

    backendUrl = backendUrl.trim().replace(/\/+$/, '');
    if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
      backendUrl = `https://${backendUrl}`;
    }

    return [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
