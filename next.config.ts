import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() renders app/forbidden.tsx when a role lacks access.
    authInterrupts: true,
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
