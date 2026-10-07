-- Catalog split, step 3 (FIL-01-F3). DESTRUCTIVE, like 0008.
-- Apply only AFTER main deploys the FIL-01 code (F2 + F3): any older build
-- still selects these columns from "Title" and breaks once they are gone.
-- `drizzle-kit migrate` applies every pending journal entry, so until that
-- deploy is live, apply 0008 + 0009 from a throwaway checkout of this commit
-- with the 0010 entry removed from drizzle/meta/_journal.json (not committed).
-- Do NOT use an older commit: its 0009 lacks the DROP NOT NULL this code needs.
-- Idempotent: guards first, IF EXISTS / IF NOT EXISTS everywhere.

-- 1. Guards: refuse instead of losing or merging data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Title" WHERE "catalogId" IS NULL) THEN
    RAISE EXCEPTION '0010: "Title" rows without catalogId; 0009 must run first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Title" GROUP BY "userId", "catalogId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0010: a user has the same film twice; merge those entries before migrating';
  END IF;
END $$;--> statement-breakpoint

-- 2. One entry per film per user, always linked.
ALTER TABLE "Title" ALTER COLUMN "catalogId" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Title_userId_catalogId_key" ON "Title" USING btree ("userId","catalogId");--> statement-breakpoint

-- 3. The film's data lives on "Catalog" now; drop the per-user copies.
DROP INDEX IF EXISTS "Title_kind_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "Title_name_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "Title_tmdbId_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "Title_imdbId_idx";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "originalName";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "kind";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "year";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "tmdbId";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "posterPath";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "backdropPath";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "runtimeMinutes";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "imdbId";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "imdbRating";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "overview";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "tmdbGenres";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "watchProvidersMx";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "watchProvidersFetchedAt";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "tmdbKeywords";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "tmdbPeople";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "originalLanguage";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "imdbVotes";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "awards";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "posterAmbient";--> statement-breakpoint
ALTER TABLE "Title" DROP COLUMN IF EXISTS "availableSince";
