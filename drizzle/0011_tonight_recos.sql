-- Hoy recommendations (FIL-I6-2). ADDITIVE and idempotent, like 0004-0007 and 0009:
-- apply BEFORE deploying the code that reads it. The build live today ignores
-- "TonightReco" and "PickEvent"."catalogId", and keeps inserting events with a
-- "titleId", which stays valid (the column only loses NOT NULL). Nothing is dropped.
-- Scaffolded with `drizzle-kit generate`, then completed by hand (guards + backfill).

-- 1. The pool of recommended films per user (a cache: safe to delete, rebuilt nightly).
CREATE TABLE IF NOT EXISTS "TonightReco" (
	"userId" text NOT NULL,
	"catalogId" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"components" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sourceKind" text NOT NULL,
	"seedCatalogId" text,
	"seedName" text,
	"computedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "TonightReco_userId_catalogId_pk" PRIMARY KEY("userId","catalogId")
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TonightReco_userId_User_id_fk') THEN
    ALTER TABLE "TonightReco" ADD CONSTRAINT "TonightReco_userId_User_id_fk"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TonightReco_catalogId_Catalog_id_fk') THEN
    ALTER TABLE "TonightReco" ADD CONSTRAINT "TonightReco_catalogId_Catalog_id_fk"
      FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TonightReco_userId_rank_idx" ON "TonightReco" USING btree ("userId","rank");--> statement-breakpoint

-- 2. Feedback is about a film: PickEvent gets a catalogId (recommendations have no Title yet)
--    and titleId becomes optional. Both nullable so the live build keeps working.
ALTER TABLE "PickEvent" ALTER COLUMN "titleId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "PickEvent" ADD COLUMN IF NOT EXISTS "catalogId" text;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PickEvent_catalogId_Catalog_id_fk') THEN
    ALTER TABLE "PickEvent" ADD CONSTRAINT "PickEvent_catalogId_Catalog_id_fk"
      FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PickEvent_userId_catalogId_idx" ON "PickEvent" USING btree ("userId","catalogId");--> statement-breakpoint

-- 3. Backfill: every existing event points at the film of its title.
UPDATE "PickEvent" e SET "catalogId" = t."catalogId"
FROM "Title" t
WHERE e."titleId" = t."id" AND e."catalogId" IS NULL;
