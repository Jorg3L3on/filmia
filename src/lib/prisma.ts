import { cache } from "react";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definida. Copia .env.example a .env y pega las URLs de Neon.",
    );
  }

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
