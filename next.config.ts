import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
