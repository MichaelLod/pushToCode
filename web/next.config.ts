import type { NextConfig } from "next";

/**
 * Next.js Configuration
 *
 * PWA Note: next-pwa has compatibility issues with Next.js 14+
 * Service worker and PWA setup will be handled separately when ready.
 * The manifest.json and meta tags are already configured in layout.tsx
 */
const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // Configure headers for PWA
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
    ];
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",
  },

  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  turbopack: {},
};

export default nextConfig;
