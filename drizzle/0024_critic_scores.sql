-- Ficha · Rotten Tomatoes y Metacritic (FIL-I36-2). ADDITIVE and idempotent: two nullable columns, no backfill.
-- Number 0024 (Plania reservation): 0023 belongs to 0023_saved_views (FIL-I34-6), so apply 0023 first
-- when both are pending, or drizzle skips the older one. Apply BEFORE deploying the code.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

ALTER TABLE "Catalog" ADD COLUMN IF NOT EXISTS "rtScore" integer;--> statement-breakpoint
ALTER TABLE "Catalog" ADD COLUMN IF NOT EXISTS "metascore" integer;
