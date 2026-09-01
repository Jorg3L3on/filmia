-- AlterTable
ALTER TABLE "Title" ADD COLUMN "tmdbId" INTEGER,
ADD COLUMN "posterPath" TEXT,
ADD COLUMN "imdbId" TEXT,
ADD COLUMN "imdbRating" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Title_tmdbId_idx" ON "Title"("tmdbId");

-- CreateIndex
CREATE INDEX "Title_imdbId_idx" ON "Title"("imdbId");
