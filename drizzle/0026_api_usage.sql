-- Admin panel · uso de APIs (FIL-I37-1). ADDITIVE and idempotent: one new table, no backfill.
-- One row per provider ('omdb' | 'tmdb') per UTC day, bumped once per real network call.
-- Number 0026 (Plania reservation), after 0025_user_last_active_at. Until applied, the counters
-- swallow the missing-table error and /admin shows «—» for the quota.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

CREATE TABLE IF NOT EXISTS "ApiUsage" (
	"provider" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ApiUsage_provider_day_pk" PRIMARY KEY("provider","day")
);
