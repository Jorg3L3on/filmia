import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@neondatabase/serverless"],
  // Cache Components / `use cache: private` needs cacheComponents: true, which
  // drops `dynamic` and would prerender cookie reads in the root layout.
  // staleTimes.dynamic lets warm soft-nav reuse the client RSC payload so
  // force-dynamic routes skip a blank loading.tsx flash. Mutations still
  // revalidatePath; this does not share cache across users.
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "media.themoviedb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
