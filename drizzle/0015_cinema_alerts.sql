CREATE TABLE "CinemaAlert" (
	"userId" text NOT NULL,
	"catalogId" text NOT NULL,
	"mxReleaseDate" date NOT NULL,
	"sentAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "CinemaAlert_userId_catalogId_mxReleaseDate_pk" PRIMARY KEY("userId","catalogId","mxReleaseDate")
);
--> statement-breakpoint
ALTER TABLE "CinemaAlert" ADD CONSTRAINT "CinemaAlert_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CinemaAlert" ADD CONSTRAINT "CinemaAlert_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;