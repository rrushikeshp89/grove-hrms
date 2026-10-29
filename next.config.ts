import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Until sign-in lands in Phase 2, the design system is the front door.
  async redirects() {
    return [{ source: "/", destination: "/design", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
