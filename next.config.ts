import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@neondatabase/serverless"],
  // Auth-gated pages keep `dynamic = AUTH_PAGE_DYNAMIC` (`force-dynamic`) so
  // Neon HTTP fetches are not shared across users. Do not enable
  // cacheComponents: it drops `dynamic` and would prerender cookie reads
  // in the root layout. staleTimes.dynamic lets warm soft-nav reuse the
  // client RSC payload so those routes skip a blank loading.tsx flash.
  // TMDB/OMDb use unstable_cache (86400s) so metadata is not refetched
  // on every ficha. Mutations still revalidatePath.
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
