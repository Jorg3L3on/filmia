import { config as loadEnv } from "dotenv";
import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, titles } from "../src/db/index";
import { fetchImdbScore, isOmdbConfigured } from "../src/lib/omdb";
import { formatAmbientRgb } from "../src/lib/poster-ambient";
import { sampleAmbientFromPosterPath } from "../src/lib/poster-ambient-server";
import { runPool } from "../src/lib/run-pool";
import { getTmdbDetails, isTmdbConfigured } from "../src/lib/tmdb";
import { computeTonightForUser } from "../src/lib/tonight-store";

/**
 * Esta noche backfill: keywords + people + language (TMDB), votes (OMDb) and
 * poster ambient (sharp) for titles that still lack them, then precompute
 * every user's decks. Idempotent; `--force` refetches everything.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida.");
}

const force = process.argv.includes("--force");
const CONCURRENCY = 4;

const needsTaste = or(
  sql`jsonb_array_length(${titles.tmdbKeywords}) = 0`,
  sql`jsonb_array_length(${titles.tmdbPeople}) = 0`,
  isNull(titles.originalLanguage),
);

const backfill = async () => {
  if (!isTmdbConfigured()) {
    throw new Error("TMDB_API_KEY no está configurada.");
  }
  if (!isOmdbConfigured()) {
    console.warn("OMDB_API_KEY ausente: se omiten los votos IMDb.");
  }

  const rows = force
    ? await db.query.titles.findMany({ where: isNotNull(titles.tmdbId), orderBy: [asc(titles.name)] })
    : await db.query.titles.findMany({
        where: and(
          isNotNull(titles.tmdbId),
          or(
            needsTaste,
            and(isNotNull(titles.imdbId), isNull(titles.imdbVotes)),
            and(isNotNull(titles.imdbId), isNull(titles.awards)),
            and(isNotNull(titles.posterPath), isNull(titles.posterAmbient)),
          ),
        ),
        orderBy: [asc(titles.name)],
      });

  console.log(`${rows.length} títulos por enriquecer.`);
  let updated = 0;
  let failed = 0;

  await runPool(rows, CONCURRENCY, async (title) => {
    try {
      const patch: Record<string, unknown> = {};
      const hasKeywords = Array.isArray(title.tmdbKeywords) && title.tmdbKeywords.length > 0;
      const hasPeople = Array.isArray(title.tmdbPeople) && title.tmdbPeople.length > 0;

      if (force || !hasKeywords || !hasPeople || !title.originalLanguage) {
        const details = await getTmdbDetails(title.tmdbId!, title.kind);
        if (details.keywords.length > 0) patch.tmdbKeywords = details.keywords;
        if (details.people.length > 0) patch.tmdbPeople = details.people;
        if (details.originalLanguage) patch.originalLanguage = details.originalLanguage;
        if (!title.runtimeMinutes && details.runtimeMinutes) patch.runtimeMinutes = details.runtimeMinutes;
        if (!title.posterPath && details.posterPath) patch.posterPath = details.posterPath;
      }

      if (
        title.imdbId &&
        (force || title.imdbVotes == null || title.awards == null) &&
        isOmdbConfigured()
      ) {
        const score = await fetchImdbScore(title.imdbId);
        if (score.votes != null) patch.imdbVotes = score.votes;
        if (score.rating != null && title.imdbRating == null) patch.imdbRating = score.rating;
        if (score.awards && (force || !title.awards)) patch.awards = score.awards;
      }

      const posterPath = (patch.posterPath as string | undefined) ?? title.posterPath;
      if (posterPath && (force || !title.posterAmbient)) {
        patch.posterAmbient = formatAmbientRgb(await sampleAmbientFromPosterPath(posterPath));
      }

      if (Object.keys(patch).length === 0) {
        return;
      }
      await db.update(titles).set(patch).where(eq(titles.id, title.id));
      updated += 1;
      console.log(`✓ ${title.name}${title.year ? ` (${title.year})` : ""} · ${Object.keys(patch).join(", ")}`);
    } catch (error) {
      failed += 1;
      console.log(`✗ ${title.name}: ${error instanceof Error ? error.message : "desconocido"}`);
    }
  });

  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } });
  for (const user of userRows) {
    const result = await computeTonightForUser(user.id);
    console.log(
      `★ ${user.email}: ${result.lenses.map((lens) => `${lens.name} (${lens.picks.length})`).join(" · ") || "sin picks"}`,
    );
  }

  console.log(`\nBackfill Esta noche: ${updated} actualizados, ${failed} fallidos (${rows.length} revisados).`);
};

backfill().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
