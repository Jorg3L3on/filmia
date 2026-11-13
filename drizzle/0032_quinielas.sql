CREATE TABLE "QuinielaCeremony" (
	"ceremonyId" text PRIMARY KEY NOT NULL,
	"closesAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QuinielaGroupMember" (
	"groupId" text NOT NULL,
	"userId" text NOT NULL,
	"joinedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "QuinielaGroupMember_groupId_userId_pk" PRIMARY KEY("groupId","userId")
);
--> statement-breakpoint
CREATE TABLE "QuinielaGroup" (
	"id" text PRIMARY KEY NOT NULL,
	"ceremonyId" text NOT NULL,
	"ownerId" text NOT NULL,
	"name" text NOT NULL,
	"tokenHash" text NOT NULL,
	"tokenVersion" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QuinielaVote" (
	"userId" text NOT NULL,
	"ceremonyId" text NOT NULL,
	"categoryId" text NOT NULL,
	"nomineeId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "QuinielaVote_userId_ceremonyId_categoryId_pk" PRIMARY KEY("userId","ceremonyId","categoryId")
);
--> statement-breakpoint
CREATE TABLE "QuinielaWinner" (
	"ceremonyId" text NOT NULL,
	"categoryId" text NOT NULL,
	"nomineeId" text NOT NULL,
	"announcedAt" timestamp (3) DEFAULT now() NOT NULL,
	"enteredByUserId" text,
	CONSTRAINT "QuinielaWinner_ceremonyId_categoryId_pk" PRIMARY KEY("ceremonyId","categoryId")
);
--> statement-breakpoint
ALTER TABLE "QuinielaGroupMember" ADD CONSTRAINT "QuinielaGroupMember_groupId_QuinielaGroup_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."QuinielaGroup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "QuinielaGroupMember" ADD CONSTRAINT "QuinielaGroupMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "QuinielaGroup" ADD CONSTRAINT "QuinielaGroup_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "QuinielaVote" ADD CONSTRAINT "QuinielaVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "QuinielaWinner" ADD CONSTRAINT "QuinielaWinner_enteredByUserId_User_id_fk" FOREIGN KEY ("enteredByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "QuinielaGroupMember_userId_idx" ON "QuinielaGroupMember" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "QuinielaGroup_tokenHash_key" ON "QuinielaGroup" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "QuinielaGroup_ownerId_idx" ON "QuinielaGroup" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "QuinielaVote_ceremonyId_idx" ON "QuinielaVote" USING btree ("ceremonyId");