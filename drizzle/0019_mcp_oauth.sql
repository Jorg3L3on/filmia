-- MCP connector, OAuth server and personal tokens (FIL-I20-1). ADDITIVE and idempotent:
-- new tables only, nothing reads them until MCP_ENABLED=1. Apply BEFORE deploying the code.
-- Scaffolded with `drizzle-kit generate`, then made idempotent by hand.

CREATE TABLE IF NOT EXISTS "McpOAuthAuthorizationCode" (
	"id" text PRIMARY KEY NOT NULL,
	"codeHash" text NOT NULL,
	"clientId" text NOT NULL,
	"userId" text NOT NULL,
	"redirectUri" text NOT NULL,
	"codeChallenge" text NOT NULL,
	"resource" text NOT NULL,
	"allowWrite" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"usedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthClient" (
	"id" text PRIMARY KEY NOT NULL,
	"clientName" text NOT NULL,
	"redirectUris" text[] NOT NULL,
	"grantTypes" text[] NOT NULL,
	"responseTypes" text[] NOT NULL,
	"tokenEndpointAuthMethod" text NOT NULL,
	"clientUri" text,
	"logoUri" text,
	"clientSecretHash" text,
	"isCimd" boolean DEFAULT false NOT NULL,
	"fetchedAt" timestamp (3),
	"firstTokenAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthGrant" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"clientId" text NOT NULL,
	"authorizationCodeId" text,
	"tokenPrefix" text NOT NULL,
	"tokenHash" text NOT NULL,
	"refreshTokenHash" text NOT NULL,
	"previousRefreshTokenHash" text,
	"allowWrite" boolean DEFAULT false NOT NULL,
	"resource" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"refreshExpiresAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp (3),
	"revokedAt" timestamp (3),
	"revokedReason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthTokenAttempt" (
	"id" text PRIMARY KEY NOT NULL,
	"grantType" text,
	"clientIdKind" text NOT NULL,
	"hasCode" boolean NOT NULL,
	"hasVerifier" boolean NOT NULL,
	"hasAssertion" boolean NOT NULL,
	"resourceKind" text NOT NULL,
	"error" text NOT NULL,
	"invalidGrantReason" text,
	"httpStatus" integer NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpPersonalToken" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"tokenPrefix" text NOT NULL,
	"tokenHash" text NOT NULL,
	"allowWrite" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp (3),
	"revokedAt" timestamp (3)
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpOAuthAuthorizationCode_clientId_McpOAuthClient_id_fk') THEN
    ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_clientId_McpOAuthClient_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."McpOAuthClient"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpOAuthAuthorizationCode_userId_User_id_fk') THEN
    ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpOAuthGrant_userId_User_id_fk') THEN
    ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpOAuthGrant_clientId_McpOAuthClient_id_fk') THEN
    ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_clientId_McpOAuthClient_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."McpOAuthClient"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpPersonalToken_userId_User_id_fk') THEN
    ALTER TABLE "McpPersonalToken" ADD CONSTRAINT "McpPersonalToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_codeHash_key" ON "McpOAuthAuthorizationCode" USING btree ("codeHash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthGrant_tokenPrefix_key" ON "McpOAuthGrant" USING btree ("tokenPrefix");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthGrant_refreshTokenHash_key" ON "McpOAuthGrant" USING btree ("refreshTokenHash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_previousRefreshTokenHash_idx" ON "McpOAuthGrant" USING btree ("previousRefreshTokenHash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_authorizationCodeId_idx" ON "McpOAuthGrant" USING btree ("authorizationCodeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_userId_idx" ON "McpOAuthGrant" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthTokenAttempt_createdAt_idx" ON "McpOAuthTokenAttempt" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpPersonalToken_tokenPrefix_key" ON "McpPersonalToken" USING btree ("tokenPrefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpPersonalToken_userId_idx" ON "McpPersonalToken" USING btree ("userId");