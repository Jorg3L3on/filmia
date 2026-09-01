import "dotenv/config";
import { defineConfig } from "prisma/config";

// `env()` throws while loading this file, so `prisma generate` (Vercel postinstall)
// fails without Neon secrets. `process.env` is lazy: generate works without a URL;
// migrate/seed still require DATABASE_URL_UNPOOLED from the environment.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
