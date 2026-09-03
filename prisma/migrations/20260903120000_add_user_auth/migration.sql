-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- Demo user for existing global data (password: filmia-demo)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt")
VALUES (
    'cm4demofilmia00000000001',
    'demo@filmia.local',
    '$2b$12$QfCtRVd3qSuaRtfCIkKZxudmROvd/OHrmz47pOSqqyAQkEh13Ibr6',
    'Demo Filmia',
    CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "Title" ADD COLUMN "userId" TEXT;
ALTER TABLE "List" ADD COLUMN "userId" TEXT;
ALTER TABLE "Tag" ADD COLUMN "userId" TEXT;

-- Backfill existing rows to demo user
UPDATE "Title" SET "userId" = 'cm4demofilmia00000000001' WHERE "userId" IS NULL;
UPDATE "List" SET "userId" = 'cm4demofilmia00000000001' WHERE "userId" IS NULL;
UPDATE "Tag" SET "userId" = 'cm4demofilmia00000000001' WHERE "userId" IS NULL;

-- Make userId required
ALTER TABLE "Title" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "List" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "userId" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Tag_slug_key";
DROP INDEX IF EXISTS "List_slug_key";

-- CreateIndex
CREATE INDEX "Title_userId_idx" ON "Title"("userId");
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");
CREATE UNIQUE INDEX "Tag_userId_slug_key" ON "Tag"("userId", "slug");
CREATE INDEX "List_userId_idx" ON "List"("userId");
CREATE UNIQUE INDEX "List_userId_slug_key" ON "List"("userId", "slug");

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "List" ADD CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
