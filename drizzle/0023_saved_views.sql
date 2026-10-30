-- Quiero ver · vistas guardadas (FIL-I34-6). ADDITIVE and idempotent: one new table only.
-- Apply BEFORE deploying the code, after 0022.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

CREATE TABLE IF NOT EXISTS "SavedView" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedView_userId_User_id_fk') THEN
    ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "SavedView_userId_idx" ON "SavedView" USING btree ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "SavedView_userId_pinned_key" ON "SavedView" USING btree ("userId") WHERE "SavedView"."pinned";
