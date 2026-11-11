-- Catalog · Mexican-facing title and extra search strings (FIL-I48-1).
-- ADDITIVE and idempotent: one jsonb column, default []. This file does not backfill rows.
-- Name preference lives on Catalog.name / originalName / alternateNames in src/db/schema.ts:
-- name is the MX alternative when it differs from originalName, otherwise the es-MX title;
-- originalName is TMDB's original title; alternateNames holds MX, original, and en-US
-- when that title differs. Apply before the code that reads the column.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

ALTER TABLE "Catalog" ADD COLUMN IF NOT EXISTS "alternateNames" jsonb DEFAULT '[]'::jsonb NOT NULL;
