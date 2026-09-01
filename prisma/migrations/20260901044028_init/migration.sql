-- CreateEnum
CREATE TYPE "TitleKind" AS ENUM ('MOVIE', 'SERIES');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('NETFLIX', 'PRIME', 'MAX', 'DISNEY', 'CLARO');

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "kind" "TitleKind" NOT NULL,
    "year" INTEGER,
    "rating" INTEGER,
    "review" TEXT,
    "platform" "Platform",
    "watchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleTag" (
    "titleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TitleTag_pkey" PRIMARY KEY ("titleId","tagId")
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "listId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("listId","titleId")
);

-- CreateIndex
CREATE INDEX "Title_kind_idx" ON "Title"("kind");

-- CreateIndex
CREATE INDEX "Title_rating_idx" ON "Title"("rating");

-- CreateIndex
CREATE INDEX "Title_name_idx" ON "Title"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ListItem_listId_position_idx" ON "ListItem"("listId", "position");

-- AddForeignKey
ALTER TABLE "TitleTag" ADD CONSTRAINT "TitleTag_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleTag" ADD CONSTRAINT "TitleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
