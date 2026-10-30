import { config as loadEnv } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, catalog } from "../src/db/index";
import { awardChipLabel } from "../src/lib/awards";
import { isOmdbConfigured, lookupOmdbScore, OmdbRefusedError } from "../src/lib/omdb";
import { runPool } from "../src/lib/run-pool";

/**
 * Quiero ver «Premiadas»: fill `Title.awards` from OMDb for every title with an
 * IMDb id (one OMDb call per title; the free tier allows 1 000/day). Also fills
 * missing votes / rating and the Rotten Tomatoes / Metacritic scores (FIL-I36) while it is there.
 * Idempotent; `--criticas` also takes titles that have awards but no critic score yet;
 * `--force` refetches everything; `--dry-run` only reports what it would write.
 *
 * Runs over several days on the free tier: it stops at the daily limit (OMDb answers 401),
 * and remembers every title OMDb already answered in `scripts/.cache/` (one file per database),
 * so the next day starts with titles not asked yet instead of the ones OMDb has nothing for.
 * Delete that file (or pass `--force`) to ask them again.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

const force = process.argv.includes("--force");
const critics = process.argv.includes("--criticas");
const dryRun = process.argv.includes("--dry-run");
const CONCURRENCY = 4;
const SAVE_EVERY = 25;

// One file per database so a local run never hides titles from a prod run.
const databaseKey = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  return `${url.hostname}${url.pathname}`.replace(/[^a-zA-Z0-9.-]+/g, "_");
})();
const CACHE_DIR = join(process.cwd(), "scripts/.cache");
const checkedPath = join(CACHE_DIR, `omdb-checked-${databaseKey}.json`);

const loadChecked = () => {
  try {
    return new Set(JSON.parse(readFileSync(checkedPath, "utf8")) as string[]);
  } catch {
    return new Set<string>();
  }
};

const saveChecked = (checked: Set<string>) => {
  if (dryRun) {
    return;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(checkedPath, JSON.stringify([...checked]));
};

const backfill = async () => {
  if (!isOmdbConfigured()) {
    throw new Error("OMDB_API_KEY no está configurada.");
  }

  const candidates = await db.query.catalog.findMany({
    where: force
      ? isNotNull(catalog.imdbId)
      : critics
        ? and(
            isNotNull(catalog.imdbId),
            or(isNull(catalog.awards), and(isNull(catalog.rtScore), isNull(catalog.metascore))),
          )
        : and(isNotNull(catalog.imdbId), isNull(catalog.awards)),
    columns: {
      id: true,
      name: true,
      year: true,
      imdbId: true,
      imdbRating: true,
      imdbVotes: true,
      awards: true,
      rtScore: true,
      metascore: true,
    },
    orderBy: [asc(catalog.name)],
  });

  const checked = loadChecked();
  const rows = force ? candidates : candidates.filter((row) => !checked.has(row.imdbId!));
  const skipped = candidates.length - rows.length;

  console.log(
    `${rows.length} títulos por consultar en OMDb${dryRun ? " (simulación)" : ""}` +
      (skipped > 0 ? ` · ${skipped} ya consultados antes (${checkedPath}).` : "."),
  );
  let updated = 0;
  let empty = 0;
  let failed = 0;
  let refused: string | null = null;
  let sinceSave = 0;

  await runPool(rows, CONCURRENCY, async (title) => {
    if (refused) {
      return;
    }
    try {
      const { score, answered } = await lookupOmdbScore(title.imdbId!);
      if (answered) {
        checked.add(title.imdbId!);
        sinceSave += 1;
        if (sinceSave >= SAVE_EVERY) {
          sinceSave = 0;
          saveChecked(checked);
        }
      } else {
        failed += 1;
        return;
      }

      const patch: Record<string, unknown> = {};
      if (score.awards && (force || !title.awards)) patch.awards = score.awards;
      if (score.votes != null && title.imdbVotes == null) patch.imdbVotes = score.votes;
      if (score.rating != null && title.imdbRating == null) patch.imdbRating = score.rating;
      if (score.rt != null && (force || title.rtScore == null)) patch.rtScore = score.rt;
      if (score.metascore != null && (force || title.metascore == null)) patch.metascore = score.metascore;

      if (Object.keys(patch).length === 0) {
        empty += 1;
        return;
      }
      if (!dryRun) {
        await db.update(catalog).set(patch).where(eq(catalog.id, title.id));
      }
      updated += 1;
      const chip = awardChipLabel(score.awards);
      console.log(
        `✓ ${title.name}${title.year ? ` (${title.year})` : ""} · ${chip ?? "sin chip"}${
          score.awards ? ` · ${score.awards}` : ""
        }`,
      );
    } catch (error) {
      if (error instanceof OmdbRefusedError) {
        refused ??= error.message;
        return;
      }
      failed += 1;
      console.log(`✗ ${title.name}: ${error instanceof Error ? error.message : "desconocido"}`);
    }
  });

  saveChecked(checked);
  const asked = updated + empty + failed;
  console.log(
    `\nBackfill premios: ${updated} ${dryRun ? "por actualizar" : "actualizados"}, ${empty} sin datos, ${failed} fallidos (${asked} de ${rows.length} consultados).`,
  );
  if (refused) {
    console.log(
      `OMDb dejó de responder: «${refused}». Faltan ${rows.length - asked}; vuelve a correrlo mañana con los mismos argumentos.`,
    );
  }
};

backfill().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
