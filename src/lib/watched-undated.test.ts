import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { upsertTitleFromTmdbForUser } from "@/lib/add-title-from-tmdb";
import { loadAffinityLibrary } from "@/lib/affinity-store";
import { loadWatchedFilms } from "@/lib/people/store";
import { loadTitles, loadWatchedBetween } from "@/lib/queries";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";
import { markWatchedFor } from "@/lib/title-writes";
import { longestWeekStreak, monthInFilm, stripOrder, yearInFilm, type FilmEntry } from "@/lib/year-in-film";

/** FIL-I50-1 · a game's «vista alguna vez» is watched, but never a diary date. */

const entry = (id: string, day: string, overrides: Partial<FilmEntry> = {}): FilmEntry => ({
  id,
  name: id,
  posterPath: null,
  watchedAt: `${day}T12:00:00Z`,
  runtimeMinutes: 120,
  kind: "MOVIE",
  rating: null,
  genres: ["Drama"],
  ...overrides,
});

describe("year in film skips undated game answers", () => {
  const dated = [entry("a", "2026-03-02"), entry("b", "2026-03-09")];
  const undated = entry("game", "2026-03-16", { watchedUndated: true, rating: 10, genres: ["Terror"] });

  it("yearInFilm counts only dated entries", () => {
    const stats = yearInFilm([...dated, undated], 2026);
    assert.equal(stats.entries, 2);
    assert.equal(stats.hours, 4);
    assert.equal(stats.byMonth[2], 2);
    assert.deepEqual(
      stats.genres.map((genre) => genre.name),
      ["Drama"],
    );
    // Without the game answer the run is 2 weeks; with it, it would have been 3.
    assert.equal(stats.longestWeekStreak, 2);
  });

  it("monthInFilm leaves it out, and is null when it is the month's only entry", () => {
    const month = monthInFilm([...dated, undated], "2026-03");
    assert.deepEqual(
      month?.entries.map((item) => item.id),
      ["a", "b"],
    );
    assert.equal(month?.best, null);
    assert.equal(monthInFilm([undated], "2026-03"), null);
  });

  it("longestWeekStreak never sees its day and the diary strip drops it", () => {
    assert.equal(longestWeekStreak(stripOrder([...dated, undated]).map((item) => String(item.watchedAt).slice(0, 10))), 2);
    assert.deepEqual(
      stripOrder([...dated, undated]).map((item) => item.id),
      ["a", "b"],
    );
  });
});

describeWithDb("watchedUndated in the library (FIL-I50-1)", () => {
  const seed = seeder("t-undated");
  let userId = "";
  let gameFilm = { catalogId: "", tmdbId: 0 };
  let diaryFilm = { catalogId: "", tmdbId: 0 };

  const row = (catalogId: string) =>
    db.query.titles.findFirst({ where: eq(titles.catalogId, catalogId) }).then((found) => found!);

  before(async () => {
    userId = await seed.user("Nia");
    gameFilm = await seed.film({ name: "Respondida en La tanda", year: 1999 });
    diaryFilm = await seed.film({ name: "Vista con fecha", year: 2001 });
    await upsertTitleFromTmdbForUser(userId, {
      tmdbId: gameFilm.tmdbId,
      kind: "MOVIE",
      name: "Respondida en La tanda",
      destination: "watched",
      undated: true,
    });
    await upsertTitleFromTmdbForUser(userId, {
      tmdbId: diaryFilm.tmdbId,
      kind: "MOVIE",
      name: "Vista con fecha",
      destination: "watched",
      watchedAt: "2026-11-02",
    });
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("stores watchedAt with watchedUndated = true", async () => {
    const saved = await row(gameFilm.catalogId);
    assert.ok(saved.watchedAt);
    assert.equal(saved.watchedUndated, true);
    assert.equal((await row(diaryFilm.catalogId)).watchedUndated, false);
  });

  it("is not in the diary: month view, dated filter, ranges", async () => {
    const day = (await row(gameFilm.catalogId)).watchedAt!;
    const month = day.toISOString().slice(0, 7);
    const inMonth = await loadTitles(userId, { onlyWatched: true, watchedMonth: month });
    assert.ok(!inMonth.some((title) => title.catalogId === gameFilm.catalogId));
    const dated = await loadTitles(userId, { onlyWatched: true, onlyDated: true });
    assert.deepEqual(
      dated.map((title) => title.catalogId),
      [diaryFilm.catalogId],
    );
    const range = await loadWatchedBetween(userId, new Date("2000-01-01T00:00:00Z"));
    assert.deepEqual(
      range.map((title) => title.catalogId),
      [diaryFilm.catalogId],
    );
  });

  it("still counts as watched for taste, affinity and Universo", async () => {
    const watched = await loadTitles(userId, { onlyWatched: true });
    assert.ok(watched.some((title) => title.catalogId === gameFilm.catalogId));
    const { library } = await loadAffinityLibrary(userId, new Date());
    const gameTitleId = (await row(gameFilm.catalogId)).id;
    const inAffinity = library.find((title) => title.id === gameTitleId);
    assert.ok(inAffinity?.watchedAt, "affinity sees it as watched");
    const universo = await loadWatchedFilms(userId);
    assert.ok(universo.some(({ film }) => film.id === gameFilm.catalogId));
  });

  it("a second undated answer never downgrades a dated entry", async () => {
    await upsertTitleFromTmdbForUser(userId, {
      tmdbId: diaryFilm.tmdbId,
      kind: "MOVIE",
      name: "Vista con fecha",
      destination: "watched",
      undated: true,
    });
    const saved = await row(diaryFilm.catalogId);
    assert.equal(saved.watchedUndated, false);
    assert.equal(saved.watchedAt?.toISOString().slice(0, 10), "2026-11-02");
  });

  it("logging it with a date from the ficha makes it a diary entry", async () => {
    const saved = await row(gameFilm.catalogId);
    await markWatchedFor(userId, saved.id, { watchedAt: new Date("2026-10-15T12:00:00Z") });
    const after = await row(gameFilm.catalogId);
    assert.equal(after.watchedUndated, false);
    const october = await loadTitles(userId, { onlyWatched: true, watchedMonth: "2026-10" });
    assert.deepEqual(
      october.map((title) => title.catalogId),
      [gameFilm.catalogId],
    );
  });
});
