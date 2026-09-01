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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
