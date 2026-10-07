-- Catalog split, step 1 (FIL-01-F1). Additive and idempotent, like 0004–0007.
-- Apply BEFORE deploying the F2 code: the current build ignores "Catalog" and
-- "Title"."catalogId", so running it under the live build is safe. Scaffolded
-- with `drizzle-kit generate` and completed by hand (the backfill below is
-- not something drizzle can derive).
--
-- Pre-check on 2026-10-07 (784 Title rows, 7 users, 389 distinct films, no
-- user with the same film twice): 10 rows had no tmdbId — six test fixtures
-- and Matrix (1999) / Sacrificio (1986) typed in by hand in two accounts.
-- Decision (Jorge): map the two films to TMDB so the diary entries survive,
-- delete the fixtures, and refuse to run if anything else is left.

-- 1. Legacy rows without a TMDB id. The mappings skip a user who already has
--    that film (would collide with the future unique (userId, catalogId)); the
--    guard below then stops the migration instead of deleting silently.
UPDATE "Title" t SET "tmdbId" = 603
WHERE t."tmdbId" IS NULL AND t."kind" = 'MOVIE' AND t."name" = 'Matrix' AND t."year" = 1999
  AND NOT EXISTS (SELECT 1 FROM "Title" o WHERE o."userId" = t."userId" AND o."tmdbId" = 603 AND o."kind" = 'MOVIE');--> statement-breakpoint
UPDATE "Title" t SET "tmdbId" = 24657
WHERE t."tmdbId" IS NULL AND t."kind" = 'MOVIE' AND t."name" = 'Sacrificio' AND t."year" = 1986
  AND NOT EXISTS (SELECT 1 FROM "Title" o WHERE o."userId" = t."userId" AND o."tmdbId" = 24657 AND o."kind" = 'MOVIE');--> statement-breakpoint
DELETE FROM "Title"
WHERE "tmdbId" IS NULL
  AND "name" IN ('Smoke Filmia', 'Película Optimistic Uno', 'Serie Optimistic Dos');--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Title" WHERE "tmdbId" IS NULL) THEN
    RAISE EXCEPTION '0009: "Title" rows without tmdbId remain; resolve them before migrating';
  END IF;
END $$;--> statement-breakpoint

-- 2. Shared catalog table.
CREATE TABLE IF NOT EXISTS "Catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"tmdbId" integer NOT NULL,
	"kind" "TitleKind" NOT NULL,
	"name" text NOT NULL,
	"originalName" text,
	"year" integer,
	"posterPath" text,
	"backdropPath" text,
	"runtimeMinutes" integer,
	"imdbId" text,
	"imdbRating" real,
	"imdbVotes" integer,
	"awards" text,
	"overview" text,
	"tmdbGenres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tmdbKeywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tmdbPeople" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"originalLanguage" text,
	"watchProvidersMx" jsonb,
	"watchProvidersFetchedAt" timestamp (3),
	"availableSince" timestamp (3),
	"posterAmbient" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Catalog_tmdbId_kind_key" ON "Catalog" USING btree ("tmdbId","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Catalog_imdbId_idx" ON "Catalog" USING btree ("imdbId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Catalog_watchProvidersFetchedAt_idx" ON "Catalog" USING btree ("watchProvidersFetchedAt");--> statement-breakpoint

-- 3. Backfill: one row per (tmdbId, kind). The copy with the freshest MX
--    availability is the base row (deterministic id, so a re-run is a no-op);
--    nullable/empty fields are then filled from any other copy that has them,
--    and availableSince is the earliest sighting across copies.
INSERT INTO "Catalog" (
  "id", "tmdbId", "kind", "name", "originalName", "year", "posterPath", "backdropPath",
  "runtimeMinutes", "imdbId", "imdbRating", "imdbVotes", "awards", "overview",
  "tmdbGenres", "tmdbKeywords", "tmdbPeople", "originalLanguage",
  "watchProvidersMx", "watchProvidersFetchedAt", "availableSince", "posterAmbient",
  "createdAt", "updatedAt"
)
SELECT DISTINCT ON ("tmdbId", "kind")
  md5("kind"::text || ':' || "tmdbId"::text), "tmdbId", "kind", "name", "originalName", "year", "posterPath", "backdropPath",
  "runtimeMinutes", "imdbId", "imdbRating", "imdbVotes", "awards", "overview",
  "tmdbGenres", "tmdbKeywords", "tmdbPeople", "originalLanguage",
  "watchProvidersMx", "watchProvidersFetchedAt", "availableSince", "posterAmbient",
  "createdAt", now()
FROM "Title"
WHERE "tmdbId" IS NOT NULL
ORDER BY "tmdbId", "kind", "watchProvidersFetchedAt" DESC NULLS LAST, "updatedAt" DESC
ON CONFLICT ("tmdbId", "kind") DO NOTHING;--> statement-breakpoint
UPDATE "Catalog" c SET
  "originalName"     = COALESCE(c."originalName",     (SELECT t."originalName"     FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."originalName"     IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "year"             = COALESCE(c."year",             (SELECT t."year"             FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."year"             IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "posterPath"       = COALESCE(c."posterPath",       (SELECT t."posterPath"       FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."posterPath"       IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "backdropPath"     = COALESCE(c."backdropPath",     (SELECT t."backdropPath"     FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."backdropPath"     IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "runtimeMinutes"   = COALESCE(c."runtimeMinutes",   (SELECT t."runtimeMinutes"   FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."runtimeMinutes"   IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "imdbId"           = COALESCE(c."imdbId",           (SELECT t."imdbId"           FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."imdbId"           IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "imdbRating"       = COALESCE(c."imdbRating",       (SELECT t."imdbRating"       FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."imdbRating"       IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "imdbVotes"        = COALESCE(c."imdbVotes",        (SELECT t."imdbVotes"        FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."imdbVotes"        IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "awards"           = COALESCE(c."awards",           (SELECT t."awards"           FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."awards"           IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "overview"         = COALESCE(c."overview",         (SELECT t."overview"         FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."overview"         IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "originalLanguage" = COALESCE(c."originalLanguage", (SELECT t."originalLanguage" FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."originalLanguage" IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "posterAmbient"    = COALESCE(c."posterAmbient",    (SELECT t."posterAmbient"    FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND t."posterAmbient"    IS NOT NULL ORDER BY t."updatedAt" DESC LIMIT 1)),
  "tmdbGenres"   = CASE WHEN jsonb_array_length(c."tmdbGenres")   > 0 THEN c."tmdbGenres"   ELSE COALESCE((SELECT t."tmdbGenres"   FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND jsonb_array_length(t."tmdbGenres")   > 0 ORDER BY t."updatedAt" DESC LIMIT 1), c."tmdbGenres")   END,
  "tmdbKeywords" = CASE WHEN jsonb_array_length(c."tmdbKeywords") > 0 THEN c."tmdbKeywords" ELSE COALESCE((SELECT t."tmdbKeywords" FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND jsonb_array_length(t."tmdbKeywords") > 0 ORDER BY t."updatedAt" DESC LIMIT 1), c."tmdbKeywords") END,
  "tmdbPeople"   = CASE WHEN jsonb_array_length(c."tmdbPeople")   > 0 THEN c."tmdbPeople"   ELSE COALESCE((SELECT t."tmdbPeople"   FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind" AND jsonb_array_length(t."tmdbPeople")   > 0 ORDER BY t."updatedAt" DESC LIMIT 1), c."tmdbPeople")   END,
  "availableSince" = (SELECT MIN(t."availableSince") FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind"),
  "createdAt"      = (SELECT MIN(t."createdAt")      FROM "Title" t WHERE t."tmdbId" = c."tmdbId" AND t."kind" = c."kind");--> statement-breakpoint

-- 4. Link every Title to its catalog row. Nullable until 0010 (F3) makes it
--    NOT NULL and unique per user.
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "catalogId" text;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Title_catalogId_Catalog_id_fk') THEN
    ALTER TABLE "Title" ADD CONSTRAINT "Title_catalogId_Catalog_id_fk"
      FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Title_catalogId_idx" ON "Title" USING btree ("catalogId");--> statement-breakpoint
UPDATE "Title" t SET "catalogId" = c."id"
FROM "Catalog" c
WHERE t."catalogId" IS NULL AND t."tmdbId" = c."tmdbId" AND t."kind" = c."kind";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Title" WHERE "catalogId" IS NULL) THEN
    RAISE EXCEPTION '0009: some "Title" rows have no catalogId after the backfill';
  END IF;
END $$;--> statement-breakpoint

-- 5. The F3 code stops writing the old snapshot columns on "Title"; the two
--    without a default must accept NULL until 0010 drops them. The code that
--    is live today still fills them, so this is safe to apply under it.
ALTER TABLE "Title" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Title" ALTER COLUMN "kind" DROP NOT NULL;
