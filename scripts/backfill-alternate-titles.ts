import { config as loadEnv } from "dotenv";
import { asc, eq } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { catalog, db } from "../src/db/index";
import { catalogTitlePatch } from "../src/lib/catalog-enrich-core";
import {
  TITLE_BACKFILL_BATCH_SIZE,
  allowsTitleBackfill,
  runCatalogTitleBackfill,
  type CatalogTitleRow,
} from "../src/lib/catalog-title-backfill";
import { getTmdbDetails, isTmdbConfigured } from "../src/lib/tmdb";

/**
 * Backfill Mexican-facing names (FIL-I48-1). Each row goes through
 * `getTmdbDetails` (the details call that asks for alternative_titles and
 * translations) and `catalogTitlePatch`, the same title fields `enrichCatalog`
 * writes. OMDb and watch providers are not called.
 *
 *   npm run db:backfill-titles -- --dry-run
 *   npm run db:backfill-titles -- --limit=20 --batch=20 --pause=250
 *
 * Refuses any DATABASE_URL that is not local. `--allow-remote` lifts that
 * guard; do not point it at production.
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL no está definida.");
}

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

const dryRun = process.argv.includes("--dry-run");
const allowRemote = process.argv.includes("--allow-remote");
const limit = Number(argValue("limit") ?? Number.POSITIVE_INFINITY);
const batchSize = Number(argValue("batch") ?? TITLE_BACKFILL_BATCH_SIZE);
const pauseMs = Number(argValue("pause") ?? 250);

const asNames = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const backfill = async () => {
  if (!allowsTitleBackfill(databaseUrl, allowRemote)) {
    throw new Error(
      "Este backfill no escribe en producción. Usa un Postgres local, o --allow-remote solo contra una base que quieras modificar.",
    );
  }
  if (!isTmdbConfigured()) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }
  if (!Number.isFinite(pauseMs) || pauseMs < 0) {
    throw new Error("--pause tiene que ser un número de milisegundos ≥ 0.");
  }
  if (limit !== Number.POSITIVE_INFINITY && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit tiene que ser un entero ≥ 1.");
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("--batch tiene que ser un entero ≥ 1.");
  }

  const found = await db.query.catalog.findMany({
    columns: {
      id: true,
      tmdbId: true,
      kind: true,
      name: true,
      originalName: true,
      alternateNames: true,
    },
    orderBy: [asc(catalog.name)],
  });
  const rows: CatalogTitleRow[] = found.slice(0, limit).map((row) => ({
    id: row.id,
    tmdbId: row.tmdbId,
    kind: row.kind,
    name: row.name,
    originalName: row.originalName,
    alternateNames: asNames(row.alternateNames),
  }));

  console.log(
    `${rows.length} títulos${dryRun ? " (dry-run: no se escribe nada)" : ""}, lotes de ${Math.max(1, batchSize)}.`,
  );
  if (rows.length === 0) {
    return;
  }

  const stats = await runCatalogTitleBackfill({
    rows,
    batchSize,
    dryRun,
    pauseMs,
    sleep,
    log: (line) => console.log(line),
    resolve: async (row) => {
      const details = await getTmdbDetails(row.tmdbId, row.kind);
      return catalogTitlePatch(details);
    },
    write: async (row, patch) => {
      await db.update(catalog).set(patch).where(eq(catalog.id, row.id));
    },
  });

  console.log(
    `\nBackfill de títulos: ${stats.updated} ${dryRun ? "por actualizar" : "actualizados"}, ${stats.unchanged} sin cambios, ${stats.failed} fallidos, ${stats.batches} lotes.`,
  );
  if (stats.failed > 0) {
    process.exitCode = 1;
  }
};

backfill().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
