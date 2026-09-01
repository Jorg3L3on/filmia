import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, TitleKind } from "../src/generated/prisma/client";
import { fetchImdbRating, isOmdbConfigured } from "../src/lib/omdb";
import {
  getTmdbExternalIds,
  isTmdbConfigured,
  searchTmdb,
} from "../src/lib/tmdb";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const force = process.argv.includes("--force");

const pickBestMatch = (
  results: Awaited<ReturnType<typeof searchTmdb>>,
  year: number | null,
) => {
  if (results.length === 0) {
    return null;
  }

  if (year != null) {
    const exact = results.find((item) => item.year === year);
    if (exact) {
      return exact;
    }
  }

  return results[0];
};

const backfill = async () => {
  if (!isTmdbConfigured()) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }

  if (!isOmdbConfigured()) {
    console.warn("OMDB_API_KEY ausente: se guardará poster sin rating IMDb.");
  }

  const titles = await prisma.title.findMany({
    where: force
      ? {}
      : {
          OR: [{ tmdbId: null }, { posterPath: null }],
        },
    orderBy: { name: "asc" },
  });

  if (titles.length === 0) {
    console.log("Nada que enriquecer.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const title of titles) {
    try {
      const results = await searchTmdb(title.name, title.kind, title.year);
      const match = pickBestMatch(results, title.year);

      if (!match) {
        console.log(`✗ Sin match TMDB: ${title.name}${title.year ? ` (${title.year})` : ""}`);
        failed += 1;
        continue;
      }

      const imdbId = await getTmdbExternalIds(match.tmdbId, title.kind);
      const imdbRating = imdbId ? await fetchImdbRating(imdbId) : null;

      await prisma.title.update({
        where: { id: title.id },
        data: {
          tmdbId: match.tmdbId,
          posterPath: match.posterPath,
          imdbId,
          imdbRating,
          originalName: title.originalName ?? match.originalName,
          year: title.year ?? match.year,
        },
      });

      const ratingLabel =
        imdbRating != null ? ` · IMDb ${imdbRating.toFixed(1)}` : "";
      console.log(
        `✓ ${title.name}${title.year ? ` (${title.year})` : ""} → TMDB #${match.tmdbId}${ratingLabel}`,
      );
      updated += 1;
    } catch (error) {
      console.log(
        `✗ Error en ${title.name}: ${error instanceof Error ? error.message : "desconocido"}`,
      );
      failed += 1;
    }
  }

  console.log(
    `\nBackfill listo: ${updated} actualizados, ${skipped} omitidos, ${failed} fallidos (${titles.length} procesados).`,
  );
};

backfill()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
