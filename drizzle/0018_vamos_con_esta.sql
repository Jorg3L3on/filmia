-- «Vamos con esta» (FIL-I19-3). Additive: two nullable columns on "ListItem".
-- Apply BEFORE deploying the FIL-I19 build (it reads them); the previous build ignores them.
-- Rollback = leave them; the old build ignores them.
ALTER TABLE "ListItem" ADD COLUMN "chosenAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "ListItem" ADD COLUMN "chosenByUserId" text;--> statement-breakpoint
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_chosenByUserId_User_id_fk" FOREIGN KEY ("chosenByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;