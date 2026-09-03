-- Light series progress (JOR-158): watching / finished / dropped + optional season.
-- Meaningful only when Title.kind = SERIES; movies keep these columns null.

CREATE TYPE "SeriesStatus" AS ENUM ('WATCHING', 'FINISHED', 'DROPPED');

ALTER TABLE "Title" ADD COLUMN "seriesStatus" "SeriesStatus";
ALTER TABLE "Title" ADD COLUMN "seriesSeason" INTEGER;

CREATE INDEX "Title_seriesStatus_idx" ON "Title"("seriesStatus");
CREATE INDEX "Title_userId_seriesStatus_idx" ON "Title"("userId", "seriesStatus");
