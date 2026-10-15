CREATE TABLE "PlatformAlert" (
	"userId" text NOT NULL,
	"catalogId" text NOT NULL,
	"availableSince" timestamp (3) NOT NULL,
	"platform" "Platform" NOT NULL,
	"sentAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "PlatformAlert_userId_catalogId_availableSince_pk" PRIMARY KEY("userId","catalogId","availableSince")
);
--> statement-breakpoint
CREATE TABLE "PushSubscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"lastSuccessAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "PlatformAlert" ADD CONSTRAINT "PlatformAlert_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PlatformAlert" ADD CONSTRAINT "PlatformAlert_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription" USING btree ("userId");