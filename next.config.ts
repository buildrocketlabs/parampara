import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The service worker's cache names carry the build (D52), so a deploy never serves stale pages.
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? `local-${Date.now().toString(36)}`,
  },
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
