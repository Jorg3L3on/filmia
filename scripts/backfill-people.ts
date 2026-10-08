import { config as loadEnv } from "dotenv";
import { asc, eq, isNotNull } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, catalog } from "../src/db/index";
import { getTmdbDetails, isTmdbConfigured } from "../src/lib/tmdb";
import {
  parseStoredTmdbPeople,
  tmdbPeopleNeedUpgrade,
  tmdbPeopleUpgrade,
} from "../src/lib/tmdb-people";

/**
 * Ficha people backfill (FIL-I4-2): photos, characters, the DP and up to eight
 * cast for catalog rows whose `tmdbPeople` is empty or was stored before
 * photos existed. Idempotent: upgraded rows are skipped on the next run, and a
 * TMDB answer without people never overwrites what is stored.
 *
 *   npm run db:backfill-people -- --dry-run         # list what would change
 *   npm run db:backfill-people -- --limit=20        # first 20 rows only
 *   npm run db:backfill-people -- --pause=400       # ms between TMDB calls (default 250)
 *
 * Writes to whatever DATABASE_URL points at: against Neon only with Jorge's OK.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

const dryRun = process.argv.includes("--dry-run");
const limit = Number(argValue("limit") ?? Number.POSITIVE_INFINITY);
const pauseMs = Number(argValue("pause") ?? 250);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const backfill = async () => {
  if (!isTmdbConfigured()) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }

  const rows = await db.query.catalog.findMany({
    where: isNotNull(catalog.tmdbId),
    columns: { id: true, tmdbId: true, kind: true, name: true, year: true, tmdbPeople: true },
    orderBy: [asc(catalog.name)],
  });
  const pending = rows
    .filter((row) => parseStoredTmdbPeople(row.tmdbPeople).length === 0 || tmdbPeopleNeedUpgrade(row.tmdbPeople))
    .slice(0, limit);

  console.log(
    `${pending.length} de ${rows.length} títulos sin fotos/DP${dryRun ? " (dry run: no se escribe nada)" : ""}.`,
  );
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, row] of pending.entries()) {
    const label = `${row.name}${row.year ? ` (${row.year})` : ""}`;
    try {
      const details = await getTmdbDetails(row.tmdbId!, row.kind);
      const upgrade = tmdbPeopleUpgrade(row.tmdbPeople, details.people);
      if (!upgrade) {
        skipped += 1;
        console.log(`· ${label}: TMDB no trajo personas`);
      } else {
        const photos = upgrade.filter((person) => person.profilePath).length;
        const dp = upgrade.filter((person) => person.role === "dp").length;
        if (!dryRun) {
          await db.update(catalog).set({ tmdbPeople: upgrade }).where(eq(catalog.id, row.id));
        }
        updated += 1;
        console.log(`✓ ${label} · ${upgrade.length} personas, ${photos} con foto, ${dp} DP`);
      }
    } catch (error) {
      failed += 1;
      console.log(`✗ ${label}: ${error instanceof Error ? error.message : "desconocido"}`);
    }
    if (index < pending.length - 1) {
      await sleep(pauseMs);
    }
  }

  console.log(
    `\nBackfill personas: ${updated} ${dryRun ? "por actualizar" : "actualizados"}, ${skipped} sin datos, ${failed} fallidos.`,
  );
};

backfill().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
