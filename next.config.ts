import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // iPad/LAN access in next dev (host != localhost)
  allowedDevOrigins: ["192.168.1.97", "localhost"],
  // Hosting playbook (env names, migrate outside build, preview off): docs/vercel-playbook.md (JOR-213).
  // Do not run drizzle migrate from this config or from `next build`.
  devIndicators: false,
  serverExternalPackages: ["@neondatabase/serverless", "sharp"],
  // Auth-gated pages keep `export const dynamic = "force-dynamic"` (a string
  // literal — Next cannot parse a shared constant) so Neon HTTP fetches are
  // not shared across users. Do not enable cacheComponents: it drops
  // `dynamic` and would prerender cookie reads in the root layout.
  // staleTimes.dynamic lets warm soft-nav reuse the client RSC payload so
  // those routes skip a blank loading.tsx flash. Public TMDB/OMDb use
  // unstable_cache (86400s) with tags tmdb-metadata / omdb-metadata so
  // force-dynamic pages still share safe metadata. Mutations still
  // revalidatePath. Route audit: src/lib/rendering.ts (JOR-215).
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
