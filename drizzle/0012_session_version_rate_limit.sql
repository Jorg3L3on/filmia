-- Security hardening (FIL-I10-2, FIL-I10-3). ADDITIVE and idempotent, like 0011:
-- apply BEFORE deploying the code that reads it. The build live today ignores both.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

-- 1. Fixed-window rate-limit counters for login, signup and password change.
CREATE TABLE IF NOT EXISTS "RateLimit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"resetAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
-- 2. Session version: every session token carries it; bumping it revokes older sessions.
-- Existing tokens carry no claim and read as 0, which matches the default, so nobody is logged out.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" integer DEFAULT 0 NOT NULL;
