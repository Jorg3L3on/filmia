import { config as loadEnv } from "dotenv";
import { asc, isNull, or } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { catalog, db } from "../src/db/index";
import { enrichCatalog } from "../src/lib/catalog-enrich";
import { runPool } from "../src/lib/run-pool";
import { isTmdbConfigured } from "../src/lib/tmdb";

/**
 * Fill incomplete catalog rows (no poster, no IMDb id, no synopsis) from TMDB
 * + OMDb, one pass per film, shared by every user. Only empty columns are
 * filled: stored names, posters and ratings are never replaced (a failed
 * OMDb lookup leaves ratings as they are). `--force` checks every row, still
 * filling only what is missing.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

const force = process.argv.includes("--force");
const CONCURRENCY = 4;

const backfill = async () => {
  if (!isTmdbConfigured()) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }

  const rows = await db.query.catalog.findMany({
    where: force
      ? undefined
      : or(isNull(catalog.posterPath), isNull(catalog.imdbId), isNull(catalog.overview)),
    // Every column: enrichment compares against it to fill only what is empty.
    orderBy: [asc(catalog.name)],
  });

  if (rows.length === 0) {
    console.log("Nada que enriquecer.");
    return;
  }

  console.log(`${rows.length} fichas por enriquecer.`);
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  await runPool(rows, CONCURRENCY, async (film) => {
    try {
      const wrote = await enrichCatalog(film, { onlyMissing: film });
      if (wrote) {
        updated += 1;
        console.log(`✓ ${film.name}${film.year ? ` (${film.year})` : ""} · TMDB #${film.tmdbId}`);
      } else {
        unchanged += 1;
        console.log(`· Sin nada nuevo que llenar: ${film.name} (#${film.tmdbId})`);
      }
    } catch (error) {
      failed += 1;
      console.log(`✗ ${film.name}: ${error instanceof Error ? error.message : "desconocido"}`);
    }
  });

  console.log(
    `\nBackfill listo: ${updated} actualizadas, ${unchanged} sin cambios, ${failed} fallidas (${rows.length} procesadas).`,
  );
};

backfill().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
