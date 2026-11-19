import type { NextConfig } from "next";

// QA P1-10: without NEXT_PUBLIC_API_URL a non-production build talks to the API
// on its own host (port 3001), never to the live API. Say so at build time so a
// misconfigured preview or staging build is noticed before anyone uses it.
if (!process.env.NEXT_PUBLIC_API_URL && process.env.VERCEL_ENV !== "production") {
  console.warn(
    "[next.config] NEXT_PUBLIC_API_URL is not set. This build will call the API on " +
      "its own host (port 3001) and never the live production API. Set " +
      "NEXT_PUBLIC_API_URL to point it somewhere else.",
  );
}

const nextConfig: NextConfig = {
  // Standalone output is for Docker only; Vercel requires native serverless output.
  output: process.env.VERCEL ? undefined : "standalone",
  devIndicators: false,
  images: {
    unoptimized: true,
    qualities: [75, 90],
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
    // Only a Vercel PRODUCTION deployment may fall back to the live API; any
    // other build (local `next start`, previews) proxies to a local backend.
    let backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
      (process.env.VERCEL_ENV === 'production'
        ? 'https://textile-automation-platform.onrender.com'
        : 'http://127.0.0.1:3001');

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
