import { describe } from "node:test";
import { installLocalPg } from "@/db/local-pg";

/**
 * Tests that need a real database run against a local Postgres (never Neon): set
 * TEST_DATABASE_URL to a database with the current schema (`npm run test:db:setup`).
 * Without it these suites are skipped, so `npm test` still runs anywhere.
 */
const withUser = (value: string) => {
  // The Neon driver needs a user in the URL; local Postgres defaults to the OS account.
  const url = new URL(value);
  if (!url.username) url.username = process.env.USER || "postgres";
  return url.toString();
};

export const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim()
  ? withUser(process.env.TEST_DATABASE_URL.trim())
  : null;

if (testDatabaseUrl) {
  const host = new URL(testDatabaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`TEST_DATABASE_URL must point at a local database (got ${host}).`);
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.FILMIA_LOCAL_PG = "1";
  installLocalPg();
} else {
  // Never let a test reach Neon through a DATABASE_URL loaded from .env: queries fail fast.
  process.env.DATABASE_URL = "invalid://tests-run-without-a-database";
}

/** `describe` when a local test database is configured, `describe.skip` otherwise. */
export const describeWithDb: typeof describe = (testDatabaseUrl ? describe : describe.skip) as typeof describe;
