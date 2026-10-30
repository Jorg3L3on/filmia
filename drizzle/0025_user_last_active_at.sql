-- Admin panel · última actividad (FIL-I37-1). ADDITIVE and idempotent: one nullable column, no backfill.
-- Number 0025 (Plania reservation). Apply 0025 then 0026. The code tolerates both missing, so order
-- against the deploy does not matter; until applied, /admin shows «—» for last activity.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" timestamp (3);
