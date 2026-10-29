-- Quitar Rutas (FIL-I33-4): DESTRUCTIVE. Deletes the curated lists (List.curated = true; their
-- items, members and invites cascade), drops Ruta + RutaPaso, User.rutasOfferedAt and the
-- List.curated* columns. Keeps Title.impliedRating and every PickEvent row.
-- Apply by hand AFTER the code without Rutas (FIL-I33-1..3) is live in production. Idempotent.
-- The curated text stays in git history as data/rutas-curadas.json.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'List' AND column_name = 'curated'
  ) THEN
    DELETE FROM "List" WHERE "curated" = true;
  END IF;
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "RutaPaso" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Ruta" CASCADE;--> statement-breakpoint
ALTER TABLE "List" DROP COLUMN IF EXISTS "curated";--> statement-breakpoint
ALTER TABLE "List" DROP COLUMN IF EXISTS "curatedFrom";--> statement-breakpoint
ALTER TABLE "List" DROP COLUMN IF EXISTS "curatedUntil";--> statement-breakpoint
ALTER TABLE "List" DROP COLUMN IF EXISTS "curatedFor";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "rutasOfferedAt";
