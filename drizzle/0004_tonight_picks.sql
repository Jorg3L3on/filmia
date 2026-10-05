-- Esta noche (Hoy): taste features, quality votes, ambient color, freshness, bedtime, precomputed picks + feedback.
-- Additive and idempotent on purpose: Neon prod already holds 0000–0003.
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "tmdbKeywords" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "tmdbPeople" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "originalLanguage" text;--> statement-breakpoint
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "imdbVotes" integer;--> statement-breakpoint
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "posterAmbient" text;--> statement-breakpoint
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "availableSince" timestamp (3);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nightEndsAt" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TonightPick" (
	"userId" text NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action,
	"titleId" text NOT NULL REFERENCES "public"."Title"("id") ON DELETE cascade ON UPDATE no action,
	"lens" text NOT NULL,
	"lensName" text NOT NULL,
	"lensRank" integer DEFAULT 0 NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"components" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wildcard" integer DEFAULT 0 NOT NULL,
	"computedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "TonightPick_userId_lens_titleId_pk" PRIMARY KEY("userId","lens","titleId")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PickEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action,
	"titleId" text NOT NULL REFERENCES "public"."Title"("id") ON DELETE cascade ON UPDATE no action,
	"kind" text NOT NULL,
	"lens" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TonightPick_userId_lensRank_rank_idx" ON "TonightPick" USING btree ("userId","lensRank","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PickEvent_userId_createdAt_idx" ON "PickEvent" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PickEvent_userId_titleId_idx" ON "PickEvent" USING btree ("userId","titleId");
