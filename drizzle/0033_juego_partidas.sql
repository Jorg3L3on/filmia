CREATE TABLE "JuegoPartida" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"juego" text NOT NULL,
	"mode" text NOT NULL,
	"lens" text NOT NULL,
	"day" text,
	"rondaId" text,
	"content" jsonb NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"startedAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"finishedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "JuegoRonda" (
	"id" text PRIMARY KEY NOT NULL,
	"juego" text NOT NULL,
	"lens" text NOT NULL,
	"day" text NOT NULL,
	"seed" text NOT NULL,
	"content" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "JuegoPartida" ADD CONSTRAINT "JuegoPartida_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JuegoPartida" ADD CONSTRAINT "JuegoPartida_rondaId_JuegoRonda_id_fk" FOREIGN KEY ("rondaId") REFERENCES "public"."JuegoRonda"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "JuegoPartida_daily_key" ON "JuegoPartida" USING btree ("userId","juego","lens","day") WHERE "mode" = 'diaria';--> statement-breakpoint
CREATE INDEX "JuegoPartida_userId_juego_mode_idx" ON "JuegoPartida" USING btree ("userId","juego","mode");--> statement-breakpoint
CREATE INDEX "JuegoPartida_juego_day_idx" ON "JuegoPartida" USING btree ("juego","day");--> statement-breakpoint
CREATE INDEX "JuegoPartida_startedAt_idx" ON "JuegoPartida" USING btree ("startedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "JuegoRonda_juego_lens_day_key" ON "JuegoRonda" USING btree ("juego","lens","day");