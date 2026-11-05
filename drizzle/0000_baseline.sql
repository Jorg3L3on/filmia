-- Baseline: el esquema que dejaron las migraciones Prisma históricas
-- (prisma/migrations 20260901044028_init … 20260904220000_add_title_tmdb_genres,
-- borradas del repo en a4ad024). Drizzle toma el relevo a partir de 0001.
--
-- Neon nunca vuelve a correr este archivo: drizzle-kit migrate solo aplica las
-- migraciones cuyo "when" es mayor que el created_at de la última fila de
-- drizzle.__drizzle_migrations, y no compara hashes de las ya aplicadas.
-- Además todo va dentro de un guard: si "Title" ya existe (una base de la era
-- Prisma sin ledger de drizzle), no hace nada.
--
-- Estado neto, no los pasos: Platform ya trae todos sus valores, sin el índice
-- global "Tag_name_key" (borrado en Prisma) y sin el usuario demo (dato, no
-- esquema; lo crea `npm run db:seed`). "Title"."overview" lo añade 0001.

DO $$
BEGIN
  IF to_regclass('public."Title"') IS NOT NULL THEN
    RETURN;
  END IF;

  CREATE TYPE "TitleKind" AS ENUM ('MOVIE', 'SERIES');
  CREATE TYPE "Platform" AS ENUM (
    'NETFLIX', 'PRIME', 'MAX', 'DISNEY', 'CLARO', 'APPLE', 'MUBI',
    'PARAMOUNT', 'CRUNCHYROLL', 'VIX', 'PLUTO', 'AMCPLUS', 'CURIOSITY', 'LIONSGATE'
  );
  CREATE TYPE "ListKind" AS ENUM ('COLLECTION', 'WATCHLIST');
  CREATE TYPE "SeriesStatus" AS ENUM ('WATCHING', 'FINISHED', 'DROPPED');

  CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamingPlatforms" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  );

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
    "tmdbId" INTEGER,
    "posterPath" TEXT,
    "imdbId" TEXT,
    "imdbRating" DOUBLE PRECISION,
    "watchProvidersMx" JSONB,
    "watchProvidersFetchedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "seriesStatus" "SeriesStatus",
    "seriesSeason" INTEGER,
    "tmdbGenres" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "TitleTag" (
    "titleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "TitleTag_pkey" PRIMARY KEY ("titleId", "tagId")
  );

  CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" "ListKind" NOT NULL DEFAULT 'COLLECTION',
    "slug" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "ListItem" (
    "listId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueNote" TEXT,
    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("listId", "titleId")
  );

  CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
  CREATE INDEX "User_email_idx" ON "User"("email");

  CREATE INDEX "Title_kind_idx" ON "Title"("kind");
  CREATE INDEX "Title_rating_idx" ON "Title"("rating");
  CREATE INDEX "Title_name_idx" ON "Title"("name");
  CREATE INDEX "Title_tmdbId_idx" ON "Title"("tmdbId");
  CREATE INDEX "Title_imdbId_idx" ON "Title"("imdbId");
  CREATE INDEX "Title_userId_idx" ON "Title"("userId");
  CREATE INDEX "Title_seriesStatus_idx" ON "Title"("seriesStatus");
  CREATE INDEX "Title_userId_seriesStatus_idx" ON "Title"("userId", "seriesStatus");

  CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");
  CREATE UNIQUE INDEX "Tag_userId_slug_key" ON "Tag"("userId", "slug");

  CREATE INDEX "List_kind_idx" ON "List"("kind");
  CREATE INDEX "List_userId_idx" ON "List"("userId");
  CREATE UNIQUE INDEX "List_userId_slug_key" ON "List"("userId", "slug");

  CREATE INDEX "ListItem_listId_position_idx" ON "ListItem"("listId", "position");

  ALTER TABLE "Title" ADD CONSTRAINT "Title_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "List" ADD CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "TitleTag" ADD CONSTRAINT "TitleTag_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "TitleTag" ADD CONSTRAINT "TitleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END
$$;
