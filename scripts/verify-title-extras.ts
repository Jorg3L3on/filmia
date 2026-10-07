import { config as loadEnv } from "dotenv";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { catalog, db, titles, users } from "../src/db";
import { findOrCreateCatalog } from "../src/lib/catalog";
import {
  persistTitleExtras,
  storedTitleExtras,
  titleNeedsTmdbExtras,
} from "../src/lib/title-extras";

const DEMO_EMAIL = "demo@filmia.local";
/** Not a real TMDB id: the catalog row is created and removed by this script. */
const TEST_TMDB_ID = 9000154;

const fetched = {
  overview: "Dos amigos intentan comprar alcohol.",
  runtimeMinutes: 113,
  backdropPath: "/superbad-back.jpg",
  posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
  genres: [{ id: 35, name: "Comedia" }],
  tmdbId: TEST_TMDB_ID,
};

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  const demo = await db.query.users.findFirst({
    where: eq(users.email, DEMO_EMAIL),
    columns: { id: true },
  });
  assert(demo, `Missing demo user ${DEMO_EMAIL}`);

  const { row: film, created } = await findOrCreateCatalog({
    tmdbId: TEST_TMDB_ID,
    kind: "MOVIE",
    name: "Superbad extras gap",
    year: 2007,
  });
  assert(created, "Test film should not pre-exist in Catalog");

  const titleId = createId();
  await db.insert(titles).values({
    id: titleId,
    userId: demo!.id,
    catalogId: film.id,
    name: film.name,
    kind: "MOVIE",
    year: 2007,
    tmdbId: TEST_TMDB_ID,
  });

  try {
    const gapRow = {
      id: titleId,
      userId: demo!.id,
      catalogId: film.id,
      tmdbId: TEST_TMDB_ID,
      kind: "MOVIE" as const,
      posterPath: null,
      overview: null,
      tmdbGenres: [],
      runtimeMinutes: null,
      backdropPath: null,
    };

    assert(titleNeedsTmdbExtras(gapRow), "Gap row should need TMDB extras");

    const wrote = await persistTitleExtras(gapRow, fetched);
    assert(wrote, "Persist should write extras");

    const warm = await db.query.catalog.findFirst({ where: eq(catalog.id, film.id) });
    assert(warm?.posterPath === fetched.posterPath, "Persisted poster lands on the catalog");
    assert(warm?.overview === fetched.overview, "Persisted overview lands on the catalog");
    assert(warm?.runtimeMinutes === fetched.runtimeMinutes, "Persisted runtime");
    assert(warm?.backdropPath === fetched.backdropPath, "Persisted backdrop");
    assert(warm?.tmdbId === TEST_TMDB_ID, "tmdbId is the catalog key and never changes");

    // Shared by design: the title reads the extras through its catalog, no copy of its own.
    const viaTitle = await db.query.titles.findFirst({
      where: eq(titles.id, titleId),
      with: { catalog: true },
    });
    assert(viaTitle?.catalog?.overview === fetched.overview, "Title sees extras via its catalog");
    assert(viaTitle?.overview == null, "Nothing is written to the Title's own columns");

    const warmRow = {
      id: titleId,
      userId: demo!.id,
      catalogId: film.id,
      tmdbId: warm!.tmdbId,
      kind: warm!.kind,
      posterPath: warm!.posterPath,
      overview: warm!.overview,
      tmdbGenres: warm!.tmdbGenres,
      runtimeMinutes: warm!.runtimeMinutes,
      backdropPath: warm!.backdropPath,
    };
    assert(storedTitleExtras(warmRow).posterPath === fetched.posterPath, "Stored extras expose poster");
    assert(
      !titleNeedsTmdbExtras({ ...warmRow, runtimeMinutes: null }),
      "Warm row skips TMDB even without runtime",
    );

    const overwrite = await persistTitleExtras(warmRow, {
      ...fetched,
      overview: "No pises la sinopsis guardada",
      posterPath: "/other.jpg",
      runtimeMinutes: 90,
    });
    assert(!overwrite, "Second persist must not overwrite stored extras");

    const afterOverwrite = await db.query.catalog.findFirst({ where: eq(catalog.id, film.id) });
    assert(afterOverwrite?.overview === fetched.overview, "Overview stays the first persist");
    assert(afterOverwrite?.posterPath === fetched.posterPath, "Poster stays the first persist");
  } finally {
    await db.delete(titles).where(eq(titles.id, titleId));
    await db.delete(catalog).where(eq(catalog.id, film.id));
  }

  console.log("✓ Title extras persist once on the shared catalog and never overwrite stored data");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
