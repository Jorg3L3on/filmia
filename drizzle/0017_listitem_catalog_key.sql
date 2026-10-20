-- Listas compartidas, phase B (FIL-I18-5). DESTRUCTIVE, like 0010.
-- Apply only AFTER the FIL-I18 build is live: the previous build still reads
-- and writes "ListItem"."titleId", which this drops.
-- Rollback = restore the Neon snapshot taken before 0016 (items that people
-- other than the owner added have no Title to point a titleId at).
-- `drizzle-kit migrate` applies every pending entry, so before that deploy apply
-- 0016 alone from a checkout with the 0017 journal entry removed (not committed).
-- Idempotent: guards first, IF EXISTS everywhere.

-- 1. Rows the previous build inserted between 0016 and the deploy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ListItem' AND column_name = 'titleId'
  ) THEN
    UPDATE "ListItem" li
    SET "catalogId" = t."catalogId", "addedByUserId" = coalesce(li."addedByUserId", t."userId")
    FROM "Title" t
    WHERE t.id = li."titleId" AND li."catalogId" IS NULL;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ListItem" WHERE "catalogId" IS NULL) THEN
    RAISE EXCEPTION '0017: "ListItem" rows without catalogId; 0016 must run first';
  END IF;
END $$;--> statement-breakpoint

-- 2. The trigger only bridged the two builds.
DROP TRIGGER IF EXISTS "ListItem_fill_catalog" ON "ListItem";--> statement-breakpoint
DROP FUNCTION IF EXISTS "listitem_fill_catalog"();--> statement-breakpoint

-- 3. (listId, catalogId) becomes the key; titleId goes (with its foreign key,
--    whatever it is named).
ALTER TABLE "ListItem" ALTER COLUMN "catalogId" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_catalogId_pk" PRIMARY KEY("listId","catalogId");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "ListItem_listId_catalogId_key";--> statement-breakpoint
DROP INDEX IF EXISTS "ListItem_listId_titleId_key";--> statement-breakpoint
ALTER TABLE "ListItem" DROP COLUMN IF EXISTS "titleId";
