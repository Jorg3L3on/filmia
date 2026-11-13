CREATE TABLE "OscarCeremony" (
	"year" integer PRIMARY KEY NOT NULL,
	"closesAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OscarGroupMember" (
	"groupId" text NOT NULL,
	"userId" text NOT NULL,
	"joinedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "OscarGroupMember_groupId_userId_pk" PRIMARY KEY("groupId","userId")
);
--> statement-breakpoint
CREATE TABLE "OscarGroup" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"ownerId" text NOT NULL,
	"name" text NOT NULL,
	"tokenHash" text NOT NULL,
	"tokenVersion" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OscarVote" (
	"userId" text NOT NULL,
	"year" integer NOT NULL,
	"categoryId" text NOT NULL,
	"nomineeId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "OscarVote_userId_year_categoryId_pk" PRIMARY KEY("userId","year","categoryId")
);
--> statement-breakpoint
CREATE TABLE "OscarWinner" (
	"year" integer NOT NULL,
	"categoryId" text NOT NULL,
	"nomineeId" text NOT NULL,
	"announcedAt" timestamp (3) DEFAULT now() NOT NULL,
	"enteredByUserId" text,
	CONSTRAINT "OscarWinner_year_categoryId_pk" PRIMARY KEY("year","categoryId")
);
--> statement-breakpoint
ALTER TABLE "OscarGroupMember" ADD CONSTRAINT "OscarGroupMember_groupId_OscarGroup_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."OscarGroup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OscarGroupMember" ADD CONSTRAINT "OscarGroupMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OscarGroup" ADD CONSTRAINT "OscarGroup_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OscarVote" ADD CONSTRAINT "OscarVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OscarWinner" ADD CONSTRAINT "OscarWinner_enteredByUserId_User_id_fk" FOREIGN KEY ("enteredByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "OscarGroupMember_userId_idx" ON "OscarGroupMember" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "OscarGroup_tokenHash_key" ON "OscarGroup" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "OscarGroup_ownerId_idx" ON "OscarGroup" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "OscarVote_year_idx" ON "OscarVote" USING btree ("year");