-- Google SSO: accounts may sign in with Google only (no password) and store the Google `sub`.
-- Additive and idempotent on purpose, like 0004.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User" USING btree ("googleId");
