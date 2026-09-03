-- AlterTable
ALTER TABLE "Title" ADD COLUMN "watchProvidersMx" JSONB,
ADD COLUMN "watchProvidersFetchedAt" TIMESTAMP(3);
