import { config as loadEnv } from "dotenv";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

loadEnv({ path: ".env.local" });
loadEnv();

import { db, titles, users } from "../src/db";
import { hashPassword } from "../src/lib/auth/password";
import {
  persistTitleExtras,
  storedTitleExtras,
  titleNeedsTmdbExtras,
} from "../src/lib/title-extras";

const DEMO_EMAIL = "demo@filmia.local";
const OTHER_EMAIL = "extras-isolation@filmia.local";

const fetched = {
  overview: "Dos amigos intentan comprar alcohol.",
  runtimeMinutes: 113,
  backdropPath: "/superbad-back.jpg",
  posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
  genres: [{ id: 35, name: "Comedia" }],
  tmdbId: 8363,
};

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  const demo = await db.query.users.findFirst({
    where: (table, { eq: equals }) => equals(table.email, DEMO_EMAIL),
    columns: { id: true },
  });
  assert(demo, `Missing demo user ${DEMO_EMAIL}`);

  let other = await db.query.users.findFirst({
    where: (table, { eq: equals }) => equals(table.email, OTHER_EMAIL),
    columns: { id: true },
  });
  if (!other) {
    const otherId = createId();
    await db.insert(users).values({
      id: otherId,
      email: OTHER_EMAIL,
      passwordHash: await hashPassword("filmia-demo"),
      name: "Isolation",
    });
    other = { id: otherId };
  }

  const titleId = createId();
  await db.insert(titles).values({
    id: titleId,
    userId: demo!.id,
    name: "Superbad extras gap",
    kind: "MOVIE",
    year: 2007,
    tmdbId: 8363,
    posterPath: null,
    overview: null,
    tmdbGenres: [],
    runtimeMinutes: null,
    backdropPath: null,
  });

  const gapRow = {
    id: titleId,
    userId: demo!.id,
    tmdbId: 8363,
    kind: "MOVIE" as const,
    posterPath: null,
    overview: null,
    tmdbGenres: [],
    runtimeMinutes: null,
    backdropPath: null,
  };

  assert(titleNeedsTmdbExtras(gapRow), "Gap Superbad row should need TMDB extras");

  const stolen = await persistTitleExtras({ ...gapRow, userId: other!.id }, fetched);
  const afterSteal = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, demo!.id)),
  });
  assert(stolen === false || afterSteal?.posterPath == null, "Wrong userId must not persist extras");
  assert(afterSteal?.posterPath == null, "Isolation: poster stays empty after foreign persist");
  assert(afterSteal?.overview == null, "Isolation: overview stays empty after foreign persist");

  const wrote = await persistTitleExtras(gapRow, fetched);
  assert(wrote, "Owner persist should write extras");

  const warm = await db.query.titles.findFirst({
    where: and(eq(titles.id, titleId), eq(titles.userId, demo!.id)),
  });
  assert(warm?.posterPath === fetched.posterPath, "Persisted poster");
  assert(warm?.overview === fetched.overview, "Persisted overview");
  assert(warm?.runtimeMinutes === fetched.runtimeMinutes, "Persisted runtime");
  assert(warm?.backdropPath === fetched.backdropPath, "Persisted backdrop");

  const stored = storedTitleExtras({
    id: warm!.id,
    userId: warm!.userId,
    tmdbId: warm!.tmdbId,
    kind: warm!.kind,
    posterPath: warm!.posterPath,
    overview: warm!.overview,
    tmdbGenres: warm!.tmdbGenres,
    runtimeMinutes: warm!.runtimeMinutes,
    backdropPath: warm!.backdropPath,
  });
  assert(stored.posterPath === fetched.posterPath, "Stored extras expose poster");
  assert(
    !titleNeedsTmdbExtras({
      id: warm!.id,
      userId: warm!.userId,
      tmdbId: warm!.tmdbId,
      kind: warm!.kind,
      posterPath: warm!.posterPath,
      overview: warm!.overview,
      tmdbGenres: warm!.tmdbGenres,
      runtimeMinutes: null,
      backdropPath: warm!.backdropPath,
    }),
    "Warm row skips TMDB even without runtime",
  );

  const overwrite = await persistTitleExtras(
    {
      id: warm!.id,
      userId: warm!.userId,
      tmdbId: warm!.tmdbId,
      kind: warm!.kind,
      posterPath: warm!.posterPath,
      overview: warm!.overview,
      tmdbGenres: warm!.tmdbGenres,
      runtimeMinutes: warm!.runtimeMinutes,
      backdropPath: warm!.backdropPath,
    },
    {
      ...fetched,
      overview: "No pises la sinopsis guardada",
      posterPath: "/other.jpg",
      runtimeMinutes: 90,
    },
  );
  assert(!overwrite, "Second persist must not overwrite stored extras");

  const afterOverwrite = await db.query.titles.findFirst({
    where: eq(titles.id, titleId),
  });
  assert(afterOverwrite?.overview === fetched.overview, "Overview stays the first persist");
  assert(afterOverwrite?.posterPath === fetched.posterPath, "Poster stays the first persist");

  await db.delete(titles).where(eq(titles.id, titleId));
  await db.delete(users).where(eq(users.email, OTHER_EMAIL));

  console.log("✓ Persist Superbad extras, skip warm TMDB, keep userId isolation");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
