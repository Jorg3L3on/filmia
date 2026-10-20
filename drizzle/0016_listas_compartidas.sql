-- Listas compartidas, phase A (FIL-I18-1). ADDITIVE: safe while the previous
-- build still runs. ListItem gains catalogId + addedByUserId (backfilled from
-- Title) and stops requiring titleId; a temporary trigger fills catalogId for
-- rows the previous build still inserts by titleId. 0017 finishes the switch.
-- Release order: apply 0016 → deploy the FIL-I18 build → apply 0017.
-- Idempotent: IF NOT EXISTS / guarded blocks everywhere.

DO $$ BEGIN
  CREATE TYPE "public"."ListInviteKind" AS ENUM('PERSONAL', 'GROUP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."ListJoinRequestStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."ListRole" AS ENUM('EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- 1. Lists: approval before anyone joins, on by default.
ALTER TABLE "List" ADD COLUMN IF NOT EXISTS "requireApproval" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- 2. ListItem keyed by the shared Catalog row, with who added it.
ALTER TABLE "ListItem" ADD COLUMN IF NOT EXISTS "catalogId" text;--> statement-breakpoint
ALTER TABLE "ListItem" ADD COLUMN IF NOT EXISTS "addedByUserId" text;--> statement-breakpoint
UPDATE "ListItem" li
SET "catalogId" = t."catalogId", "addedByUserId" = t."userId"
FROM "Title" t
WHERE t.id = li."titleId" AND li."catalogId" IS NULL;--> statement-breakpoint

-- Guards: every item resolved, and no list holds the same film twice.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ListItem" WHERE "catalogId" IS NULL) THEN
    RAISE EXCEPTION '0016: "ListItem" rows without catalogId after the backfill';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ListItem" GROUP BY "listId", "catalogId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0016: a list holds the same film twice; merge those items before migrating';
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_addedByUserId_User_id_fk" FOREIGN KEY ("addedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- titleId stops being the key: the new build writes rows without it. Both pairs
-- stay unique so either build's ON CONFLICT target keeps working.
-- The primary key is dropped by type, not by name: Prisma-era tables may call it
-- "ListItem_pkey" rather than Drizzle's "ListItem_listId_titleId_pk".
DO $$
DECLARE pk text;
BEGIN
  SELECT conname INTO pk FROM pg_constraint
  WHERE conrelid = '"ListItem"'::regclass AND contype = 'p';
  IF pk IS NOT NULL AND pk <> 'ListItem_listId_catalogId_pk' THEN
    EXECUTE format('ALTER TABLE "ListItem" DROP CONSTRAINT %I', pk);
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "ListItem" ALTER COLUMN "titleId" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ListItem_listId_titleId_key" ON "ListItem" USING btree ("listId","titleId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ListItem_listId_catalogId_key" ON "ListItem" USING btree ("listId","catalogId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ListItem_catalogId_idx" ON "ListItem" USING btree ("catalogId");--> statement-breakpoint

-- Until 0017: rows the previous build inserts by titleId get their catalogId.
CREATE OR REPLACE FUNCTION "listitem_fill_catalog"() RETURNS trigger AS $$
BEGIN
  IF NEW."catalogId" IS NULL AND NEW."titleId" IS NOT NULL THEN
    SELECT t."catalogId", t."userId" INTO NEW."catalogId", NEW."addedByUserId"
    FROM "Title" t WHERE t.id = NEW."titleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "ListItem_fill_catalog" ON "ListItem";--> statement-breakpoint
CREATE TRIGGER "ListItem_fill_catalog" BEFORE INSERT ON "ListItem"
FOR EACH ROW EXECUTE FUNCTION "listitem_fill_catalog"();--> statement-breakpoint

-- 3. Sharing: members (the owner stays List.userId), links and join requests.
CREATE TABLE IF NOT EXISTS "ListMember" (
	"listId" text NOT NULL,
	"userId" text NOT NULL,
	"role" "ListRole" NOT NULL,
	"joinedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ListMember_listId_userId_pk" PRIMARY KEY("listId","userId")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ListInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"listId" text NOT NULL,
	"kind" "ListInviteKind" NOT NULL,
	"role" "ListRole" NOT NULL,
	"tokenHash" text NOT NULL,
	"createdByUserId" text,
	"expiresAt" timestamp (3),
	"maxUses" integer NOT NULL,
	"usedCount" integer DEFAULT 0 NOT NULL,
	"disabledAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ListJoinRequest" (
	"id" text PRIMARY KEY NOT NULL,
	"listId" text NOT NULL,
	"userId" text NOT NULL,
	"inviteId" text,
	"role" "ListRole" NOT NULL,
	"status" "ListJoinRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"decidedAt" timestamp (3),
	"decidedByUserId" text,
	"seenAt" timestamp (3)
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListMember" ADD CONSTRAINT "ListMember_listId_List_id_fk" FOREIGN KEY ("listId") REFERENCES "public"."List"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListMember" ADD CONSTRAINT "ListMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListInvite" ADD CONSTRAINT "ListInvite_listId_List_id_fk" FOREIGN KEY ("listId") REFERENCES "public"."List"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListInvite" ADD CONSTRAINT "ListInvite_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListJoinRequest" ADD CONSTRAINT "ListJoinRequest_listId_List_id_fk" FOREIGN KEY ("listId") REFERENCES "public"."List"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListJoinRequest" ADD CONSTRAINT "ListJoinRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListJoinRequest" ADD CONSTRAINT "ListJoinRequest_inviteId_ListInvite_id_fk" FOREIGN KEY ("inviteId") REFERENCES "public"."ListInvite"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListJoinRequest" ADD CONSTRAINT "ListJoinRequest_decidedByUserId_User_id_fk" FOREIGN KEY ("decidedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ListMember_userId_idx" ON "ListMember" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ListInvite_tokenHash_key" ON "ListInvite" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ListInvite_listId_idx" ON "ListInvite" USING btree ("listId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ListJoinRequest_pending_key" ON "ListJoinRequest" USING btree ("listId","userId") WHERE "status" = 'PENDING';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ListJoinRequest_userId_idx" ON "ListJoinRequest" USING btree ("userId");
