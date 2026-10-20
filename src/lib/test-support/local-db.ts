import { describe } from "node:test";
import { installLocalPg } from "@/db/local-pg";

/**
 * Tests that need a real database run against a local Postgres (never Neon): set
 * TEST_DATABASE_URL to a database with the current schema (`npm run test:db:setup`).
 * Without it these suites are skipped, so `npm test` still runs anywhere.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() || null;

if (testDatabaseUrl) {
  const host = new URL(testDatabaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`TEST_DATABASE_URL must point at a local database (got ${host}).`);
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.FILMIA_LOCAL_PG = "1";
  installLocalPg();
}

/** `describe` when a local test database is configured, `describe.skip` otherwise. */
export const describeWithDb: typeof describe = (testDatabaseUrl ? describe : describe.skip) as typeof describe;
