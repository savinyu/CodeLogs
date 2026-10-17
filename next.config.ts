import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Keep visited pages in the client router for 5 minutes, so going back to one is instant.
    // Server actions that call refresh() clear this cache, so their changes still show at once.
    staleTimes: { dynamic: 300 },
  },
  // v1's dashboard is split across the v2 pages; Today is the new home (PLAN-v2.md §3).
  async redirects() {
    return [{ source: "/dashboard", destination: "/today", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
