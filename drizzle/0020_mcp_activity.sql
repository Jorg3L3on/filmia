-- MCP connector activity log and write idempotency (FIL-I20-5, FIL-I20-6). ADDITIVE and
-- idempotent: new tables only. Apply BEFORE deploying the code, after 0019.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

CREATE TABLE IF NOT EXISTS "McpIdempotencyKey" (
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"tool" text NOT NULL,
	"argsHash" text NOT NULL,
	"response" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "McpIdempotencyKey_userId_key_pk" PRIMARY KEY("userId","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpToolCall" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"source" text NOT NULL,
	"connectionId" text NOT NULL,
	"tool" text NOT NULL,
	"ok" boolean NOT NULL,
	"errorCode" text,
	"durationMs" integer NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpIdempotencyKey_userId_User_id_fk') THEN
    ALTER TABLE "McpIdempotencyKey" ADD CONSTRAINT "McpIdempotencyKey_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpToolCall_userId_User_id_fk') THEN
    ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpIdempotencyKey_createdAt_idx" ON "McpIdempotencyKey" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpToolCall_connectionId_createdAt_idx" ON "McpToolCall" USING btree ("connectionId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpToolCall_userId_createdAt_idx" ON "McpToolCall" USING btree ("userId","createdAt");