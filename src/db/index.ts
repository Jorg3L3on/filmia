import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "@/lib/database-url";
import * as schema from "@/db/schema";

// neon-http has no interactive `db.transaction()`. Use `db.batch([...])` for
// atomic multi-query writes (one HTTP round-trip).

/**
 * FILMIA_LOCAL_PG=1 (tests, or `npm run dev` against a local database) answers the Neon HTTP
 * protocol from a plain Postgres; see `local-pg.ts`. The fetch is installed on `globalThis` by
 * `src/instrumentation.ts` or the test setup, so `pg` never enters a client bundle. Never in
 * production.
 */
type LocalPgGlobal = { __filmiaLocalPgFetch?: typeof fetch };

const createDb = () => {
  const localFetch = (globalThis as LocalPgGlobal).__filmiaLocalPgFetch;
  if (process.env.FILMIA_LOCAL_PG === "1" && process.env.NODE_ENV !== "production" && localFetch) {
    neonConfig.fetchFunction = localFetch;
  }
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
