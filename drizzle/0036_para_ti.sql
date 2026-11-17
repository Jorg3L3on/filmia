-- Para ti's shared pool (FIL-I60-2). ADDITIVE and idempotent: one new table, nothing altered or
-- dropped, so the build live today keeps working before and after it is applied. A cache: safe
-- to delete, refilled by the daily `para-ti` cron. «No me interesa» needs no table: it is a
-- PickEvent (kind less_like, lens para-ti).
-- Scaffolded with `drizzle-kit generate`, then guarded by hand.
CREATE TABLE IF NOT EXISTS "ParaTiPool" (
	"antojo" text NOT NULL,
	"kind" "TitleKind" NOT NULL,
	"catalogId" text NOT NULL,
	"rank" integer NOT NULL,
	"voteAverage" real,
	"voteCount" integer DEFAULT 0 NOT NULL,
	"fetchedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ParaTiPool_antojo_kind_catalogId_pk" PRIMARY KEY("antojo","kind","catalogId")
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParaTiPool_catalogId_Catalog_id_fk') THEN
    ALTER TABLE "ParaTiPool" ADD CONSTRAINT "ParaTiPool_catalogId_Catalog_id_fk"
      FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ParaTiPool_antojo_kind_rank_idx" ON "ParaTiPool" USING btree ("antojo","kind","rank");
