ALTER TYPE "public"."ListKind" ADD VALUE 'YEAR_TOP';--> statement-breakpoint
CREATE TABLE "CinemaRelease" (
	"catalogId" text PRIMARY KEY NOT NULL,
	"mxReleaseDate" date NOT NULL,
	"status" text NOT NULL,
	"popularity" real DEFAULT 0 NOT NULL,
	"firstSeenAt" timestamp (3) DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp (3) DEFAULT now() NOT NULL,
	"source" text DEFAULT 'tmdb' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "YearTop" (
	"year" integer NOT NULL,
	"rank" integer NOT NULL,
	"catalogId" text NOT NULL,
	"imdbRating" real NOT NULL,
	"imdbVotes" integer NOT NULL,
	"computedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "YearTop_year_rank_pk" PRIMARY KEY("year","rank")
);
--> statement-breakpoint
ALTER TABLE "List" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "CinemaRelease" ADD CONSTRAINT "CinemaRelease_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "YearTop" ADD CONSTRAINT "YearTop_catalogId_Catalog_id_fk" FOREIGN KEY ("catalogId") REFERENCES "public"."Catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "CinemaRelease_status_mxReleaseDate_idx" ON "CinemaRelease" USING btree ("status","mxReleaseDate");