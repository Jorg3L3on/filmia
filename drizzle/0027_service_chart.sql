-- Hoy en dos actos · ranking por servicio (FIL-I47-1). ADDITIVE and idempotent: one new table, no backfill.
-- Holds the latest top 10 per platform and kind in MX; the nightly cron rewrites it.
-- Number 0027 (Plania reservation), after 0026_api_usage. Until applied, Hoy's second act
-- swallows the missing-table error and shows no ranking. Rollback: DROP TABLE "ServiceChart".
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

CREATE TABLE IF NOT EXISTS "ServiceChart" (
	"platform" "Platform" NOT NULL,
	"kind" "TitleKind" NOT NULL,
	"rank" integer NOT NULL,
	"catalogId" text NOT NULL,
	"source" text NOT NULL,
	"period" date NOT NULL,
	"previousRank" integer,
	"weeksOnList" integer,
	"computedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ServiceChart_platform_kind_rank_pk" PRIMARY KEY("platform","kind","rank")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceChart_catalogId_Catalog_id_fk') THEN
    ALTER TABLE "ServiceChart" ADD CONSTRAINT "ServiceChart_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
