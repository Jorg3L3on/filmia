-- CreateEnum
CREATE TYPE "ListKind" AS ENUM ('COLLECTION', 'WATCHLIST');

-- AlterTable
ALTER TABLE "List" ADD COLUMN "kind" "ListKind" NOT NULL DEFAULT 'COLLECTION',
ADD COLUMN "slug" TEXT;

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN "queueNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "List_slug_key" ON "List"("slug");

-- CreateIndex
CREATE INDEX "List_kind_idx" ON "List"("kind");
