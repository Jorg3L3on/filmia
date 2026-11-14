CREATE TABLE "JuegoEstreno" (
	"catalogId" text PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"releaseDate" text NOT NULL,
	"resolveOn" text NOT NULL,
	"actual" integer,
	"resolvedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "JuegoPronostico" (
	"id" text PRIMARY KEY NOT NULL,
	"catalogId" text NOT NULL,
	"userId" text NOT NULL,
	"guess" integer NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "JuegoEstreno" ADD CONSTRAINT "JuegoEstreno_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JuegoPronostico" ADD CONSTRAINT "JuegoPronostico_catalogId_JuegoEstreno_catalogId_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."JuegoEstreno"("catalogId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "JuegoPronostico" ADD CONSTRAINT "JuegoPronostico_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "JuegoEstreno_month_idx" ON "JuegoEstreno" USING btree ("month");--> statement-breakpoint
CREATE INDEX "JuegoEstreno_resolveOn_idx" ON "JuegoEstreno" USING btree ("resolveOn");--> statement-breakpoint
CREATE UNIQUE INDEX "JuegoPronostico_catalogId_userId_key" ON "JuegoPronostico" USING btree ("catalogId","userId");