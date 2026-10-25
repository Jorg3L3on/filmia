-- Rutas y Universo (FIL-I26): Ruta + RutaPaso, User.rutasOfferedAt, the curated-ruta columns
-- on List (curated, curatedFrom, curatedUntil, curatedFor) and Title.impliedRating (¿Las viste?). ADDITIVE and idempotent: new tables,
-- nullable or defaulted columns. Apply BEFORE deploying the code, after 0020.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

CREATE TABLE IF NOT EXISTS "Ruta" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"shortTitle" text NOT NULL,
	"reason" text,
	"sourceKey" text NOT NULL,
	"seedCatalogId" text,
	"status" text NOT NULL,
	"startedAt" timestamp (3) DEFAULT now() NOT NULL,
	"closedAt" timestamp (3),
	"endsAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Ruta" ADD COLUMN IF NOT EXISTS "endsAt" timestamp (3);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RutaPaso" (
	"rutaId" text NOT NULL,
	"position" integer NOT NULL,
	"catalogId" text NOT NULL,
	"why" text NOT NULL,
	"hint" text NOT NULL,
	"revealedAt" timestamp (3),
	"doneAt" timestamp (3),
	CONSTRAINT "RutaPaso_rutaId_position_pk" PRIMARY KEY("rutaId","position")
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rutasOfferedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "impliedRating" integer;--> statement-breakpoint
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "curated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "curatedFrom" date;--> statement-breakpoint
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "curatedUntil" date;--> statement-breakpoint
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "curatedFor" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ruta_userId_User_id_fk') THEN
    ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ruta_seedCatalogId_Catalog_id_fk') THEN
    ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_seedCatalogId_Catalog_id_fk" FOREIGN KEY ("seedCatalogId") REFERENCES "public"."Catalog"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RutaPaso_rutaId_Ruta_id_fk') THEN
    ALTER TABLE "RutaPaso" ADD CONSTRAINT "RutaPaso_rutaId_Ruta_id_fk" FOREIGN KEY ("rutaId") REFERENCES "public"."Ruta"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RutaPaso_catalogId_Catalog_id_fk') THEN
    ALTER TABLE "RutaPaso" ADD CONSTRAINT "RutaPaso_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Ruta_userId_sourceKey_key" ON "Ruta" USING btree ("userId","sourceKey");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Ruta_userId_status_idx" ON "Ruta" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RutaPaso_catalogId_idx" ON "RutaPaso" USING btree ("catalogId");
