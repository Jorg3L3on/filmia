-- «Vamos con esta» (FIL-I19-3). Additive: two nullable columns on "ListItem".
-- The FIL-I19 build reads them, and 0017 can only run after that build is live
-- (it drops "titleId", which the previous build uses). So this runs twice:
-- by hand BEFORE the deploy (no ledger row, or 0017 would be skipped), then
-- again from `drizzle-kit migrate` after 0017, where it changes nothing and
-- only records itself. Idempotent: IF NOT EXISTS / guarded blocks.
-- Rollback = leave them; the previous build ignores them.
ALTER TABLE "ListItem" ADD COLUMN IF NOT EXISTS "chosenAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "ListItem" ADD COLUMN IF NOT EXISTS "chosenByUserId" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_chosenByUserId_User_id_fk" FOREIGN KEY ("chosenByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
