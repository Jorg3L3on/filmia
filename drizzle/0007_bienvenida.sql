-- Bienvenida (post-registration onboarding). Additive and idempotent, like 0004–0006.
-- Apply BEFORE deploying the code that reads these columns (Drizzle selects every User column on login).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingStep" text;--> statement-breakpoint
-- Every account that exists before this migration has already "onboarded": never gate them.
UPDATE "User" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
