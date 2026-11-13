CREATE TABLE "JuegoReto" (
	"id" text PRIMARY KEY NOT NULL,
	"juego" text NOT NULL,
	"lens" text NOT NULL,
	"seed" text NOT NULL,
	"content" jsonb NOT NULL,
	"fromUserId" text NOT NULL,
	"toUserId" text,
	"fromPartidaId" text,
	"toPartidaId" text,
	"linkTokenHash" text,
	"linkResult" jsonb,
	"status" text DEFAULT 'abierto' NOT NULL,
	"rematchOf" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"sentAt" timestamp (3),
	"expiresAt" timestamp (3) NOT NULL,
	"finishedAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "retosPush" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "juegosNotas" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "JuegoReto" ADD CONSTRAINT "JuegoReto_fromUserId_User_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JuegoReto" ADD CONSTRAINT "JuegoReto_toUserId_User_id_fk" FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JuegoReto" ADD CONSTRAINT "JuegoReto_fromPartidaId_JuegoPartida_id_fk" FOREIGN KEY ("fromPartidaId") REFERENCES "public"."JuegoPartida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JuegoReto" ADD CONSTRAINT "JuegoReto_toPartidaId_JuegoPartida_id_fk" FOREIGN KEY ("toPartidaId") REFERENCES "public"."JuegoPartida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "JuegoReto_toUserId_status_idx" ON "JuegoReto" USING btree ("toUserId","status");--> statement-breakpoint
CREATE INDEX "JuegoReto_fromUserId_toUserId_idx" ON "JuegoReto" USING btree ("fromUserId","toUserId");--> statement-breakpoint
CREATE INDEX "JuegoReto_createdAt_idx" ON "JuegoReto" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "JuegoReto_linkTokenHash_key" ON "JuegoReto" USING btree ("linkTokenHash");