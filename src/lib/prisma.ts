import { cache } from "react";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

// HTTP fetch pooler for Cloudflare Workers (TCP is unavailable without nodejs_compat).
// PrismaNeon@7 builds a Neon `Pool` from this config on connect(); do not pass
// an already-constructed Pool (the factory only accepts PoolConfig).
neonConfig.poolQueryViaFetch = true;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const createPrismaClient = () => {
  const connectionString = resolveDatabaseUrl();

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
};

// Un cliente por petición en Workers (evita reutilizar conexiones entre requests).
// En local, singleton global para HMR.
const getPrismaClient = cache(() => {
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }

  return createPrismaClient();
});

// Lazy so `next build` can import this module without Neon secrets.
// Runtime queries still require DATABASE_URL from the environment.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
