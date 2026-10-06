import { config as loadEnv } from "dotenv";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, titles } from "../src/db/index";
import { awardChipLabel } from "../src/lib/awards";
import { fetchImdbScore, isOmdbConfigured } from "../src/lib/omdb";
import { runPool } from "../src/lib/run-pool";

/**
 * Quiero ver «Premiadas»: fill `Title.awards` from OMDb for every title with an
 * IMDb id (one OMDb call per title; the free tier allows 1 000/day). Also fills
 * missing votes / rating while it is there. Idempotent; `--force` refetches
 * everything; `--dry-run` only reports what it would write.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");
const CONCURRENCY = 4;

const backfill = async () => {
  if (!isOmdbConfigured()) {
    throw new Error("OMDB_API_KEY no está configurada.");
  }

  const rows = await db.query.titles.findMany({
    where: force
      ? isNotNull(titles.imdbId)
      : and(isNotNull(titles.imdbId), isNull(titles.awards)),
    columns: {
      id: true,
      name: true,
      year: true,
      imdbId: true,
      imdbRating: true,
      imdbVotes: true,
      awards: true,
    },
    orderBy: [asc(titles.name)],
  });

  console.log(`${rows.length} títulos por consultar en OMDb${dryRun ? " (simulación)" : ""}.`);
  let updated = 0;
  let empty = 0;
  let failed = 0;

  await runPool(rows, CONCURRENCY, async (title) => {
    try {
      const score = await fetchImdbScore(title.imdbId!);
      const patch: Record<string, unknown> = {};
      if (score.awards && (force || !title.awards)) patch.awards = score.awards;
      if (score.votes != null && title.imdbVotes == null) patch.imdbVotes = score.votes;
      if (score.rating != null && title.imdbRating == null) patch.imdbRating = score.rating;

      if (Object.keys(patch).length === 0) {
        empty += 1;
        return;
      }
      if (!dryRun) {
        await db.update(titles).set(patch).where(eq(titles.id, title.id));
      }
      updated += 1;
      const chip = awardChipLabel(score.awards);
      console.log(
        `✓ ${title.name}${title.year ? ` (${title.year})` : ""} · ${chip ?? "sin chip"}${
          score.awards ? ` · ${score.awards}` : ""
        }`,
      );
    } catch (error) {
      failed += 1;
      console.log(`✗ ${title.name}: ${error instanceof Error ? error.message : "desconocido"}`);
    }
  });

  console.log(
    `\nBackfill premios: ${updated} ${dryRun ? "por actualizar" : "actualizados"}, ${empty} sin datos, ${failed} fallidos (${rows.length} revisados).`,
  );
};

backfill().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
