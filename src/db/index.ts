import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "@/lib/database-url";
import * as schema from "@/db/schema";

const createDb = () => {
  const sql = neon(resolveDatabaseUrl());
  return drizzle({ client: sql, schema });
};

let cachedDb: ReturnType<typeof createDb> | undefined;

export const getDb = () => {
  if (process.env.NODE_ENV !== "production") {
    cachedDb ??= createDb();
    return cachedDb;
  }

  return createDb();
};

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export * from "@/db/schema";
