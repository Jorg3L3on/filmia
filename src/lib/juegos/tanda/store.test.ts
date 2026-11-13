import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, listItems, lists, pickEvents, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { loadTitles, loadWatchedBetween } from "@/lib/queries";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";
import { TANDA_ANSWERED_KIND, TANDA_DEALT_KIND } from "@/lib/juegos/tanda/core";
import { answerTanda, openTanda, readTanda, undoLastTanda, type TandaSources } from "@/lib/juegos/tanda/store";
import type { TmdbDiscoverResult } from "@/lib/tmdb";

/** FIL-I50-3 · La tanda on the database, with TMDB stubbed by films the suite seeded. */
describeWithDb("La tanda store (FIL-I50-3)", () => {
  const seed = seeder("t-tanda");
  const now = new Date("2026-11-19T20:00:00Z");
  let userId = "";
  let pool: Array<{ catalogId: string; tmdbId: number; name: string }> = [];

  const result = (film: { tmdbId: number; name: string }, voteCount: number): TmdbDiscoverResult => ({
    tmdbId: film.tmdbId,
    name: film.name,
    originalName: film.name,
    year: 2005,
    posterPath: null,
    backdropPath: null,
    overview: null,
    kind: "MOVIE",
    voteAverage: 7.5,
    voteCount,
    popularity: 50,
    genreIds: [18],
  });

  const sources = (): TandaSources => ({
    discover: async (options = {}) =>
      (options.page ?? 1) === 1 ? pool.slice(0, 8).map((film, index) => result(film, 20_000 - index)) : pool.slice(8).map((film, index) => result(film, 9_000 - index)),
    related: async () => [],
  });

  const events = (kind: string) =>
    db.query.pickEvents.findMany({ where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, kind)) });
  const ownTitle = (catalogId: string) =>
    db.query.titles.findFirst({ where: and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)) });
  const inWatchlist = async (catalogId: string) => {
    const watchlist = await db.query.lists.findFirst({ where: and(eq(lists.userId, userId), eq(lists.slug, WATCHLIST_SLUG)) });
    const item = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, watchlist!.id), eq(listItems.catalogId, catalogId)),
    });
    return Boolean(item);
  };

  before(async () => {
    userId = await seed.user("Cero");
    pool = [];
    for (let index = 0; index < 14; index += 1) {
      const film = await seed.film({ name: `Película ${index + 1}`, year: 2005 });
      pool.push({ ...film, name: `Película ${index + 1}` });
    }
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("an account with nothing watched gets ten cards", async () => {
    const state = await openTanda(userId, now, sources());
    assert.equal(state.week, "2026-11-16");
    assert.equal(state.cards.length, 10);
    assert.equal(new Set(state.cards.map((card) => card.catalogId)).size, 10);
    assert.ok(state.cards.every((card) => card.answer === null));
  });

  it("reopening in the same week gives the same tanda, and the answers given", async () => {
    const first = await readTanda(userId, now);
    const answered = await answerTanda(userId, first.cards[0]!.catalogId, "no", now);
    assert.equal(answered.ok, true);
    const again = await openTanda(userId, new Date("2026-11-21T03:00:00Z"), sources());
    assert.deepEqual(
      again.cards.map((card) => card.catalogId),
      first.cards.map((card) => card.catalogId),
    );
    assert.equal(again.cards[0]!.answer, "no");
    assert.equal((await events(TANDA_DEALT_KIND)).length, 10);
  });

  it("each answer writes what the scope says, and nothing dated in the diary", async () => {
    const { cards } = await readTanda(userId, now);
    const [skip, liked, meh, loved, want] = cards;
    assert.equal(await ownTitle(skip!.catalogId), undefined, "«No la vi» writes no title");

    const at = (ms: number) => new Date(now.getTime() + ms);
    const likedOutcome = await answerTanda(userId, liked!.catalogId, "liked", at(1));
    assert.equal(likedOutcome.ok, true);
    await answerTanda(userId, meh!.catalogId, "meh", at(2));
    await answerTanda(userId, loved!.catalogId, "loved", at(3));
    await answerTanda(userId, want!.catalogId, "want", at(4));

    const likedRow = (await ownTitle(liked!.catalogId))!;
    assert.ok(likedRow.watchedAt);
    assert.equal(likedRow.watchedUndated, true);
    assert.equal(likedRow.impliedRating, 8);
    assert.equal(likedRow.rating, null);
    assert.equal((await ownTitle(meh!.catalogId))!.impliedRating, 4);
    assert.equal((await ownTitle(loved!.catalogId))!.impliedRating, 10);

    const wantRow = (await ownTitle(want!.catalogId))!;
    assert.equal(wantRow.watchedAt, null);
    assert.equal(await inWatchlist(want!.catalogId), true);

    assert.deepEqual(await loadWatchedBetween(userId, new Date("2000-01-01T00:00:00Z")), []);
    assert.deepEqual(await loadTitles(userId, { onlyWatched: true, onlyDated: true }), []);
    assert.equal((await loadTitles(userId, { onlyWatched: true })).length, 3);
  });

  it("refuses a card not dealt this week, and a second answer", async () => {
    const stranger = await seed.film({ name: "No repartida" });
    const refused = await answerTanda(userId, stranger.catalogId, "liked", now);
    assert.equal(refused.ok, false);
    const { cards } = await readTanda(userId, now);
    const twice = await answerTanda(userId, cards[1]!.catalogId, "meh", now);
    assert.equal(twice.ok, false);
  });

  it("Deshacer leaves the library and the events as they were before answering", async () => {
    const { cards } = await readTanda(userId, now);
    const want = cards[4]!;
    const loved = cards[3]!;
    const before = (await events(TANDA_ANSWERED_KIND)).length;

    const undoWant = await undoLastTanda(userId, now);
    assert.deepEqual(undoWant, { ok: true, catalogId: want.catalogId });
    assert.equal(await ownTitle(want.catalogId), undefined);
    assert.equal(await inWatchlist(want.catalogId), false);

    const undoLoved = await undoLastTanda(userId, now);
    assert.deepEqual(undoLoved, { ok: true, catalogId: loved.catalogId });
    assert.equal(await ownTitle(loved.catalogId), undefined);
    assert.equal((await events(TANDA_ANSWERED_KIND)).length, before - 2);

    const state = await readTanda(userId, now);
    assert.equal(state.cards[3]!.answer, null);
    assert.equal(state.cards[4]!.answer, null);
    // The card can be answered again.
    assert.equal((await answerTanda(userId, loved.catalogId, "liked", new Date(now.getTime() + 30_000))).ok, true);
  });

  it("a title the person already had is not deleted by Deshacer", async () => {
    const { cards } = await readTanda(userId, now);
    const target = cards[5]!;
    await seed.title(userId, target.catalogId, { rating: 9, watchedAt: new Date("2026-10-01T12:00:00Z") });
    await answerTanda(userId, target.catalogId, "meh", new Date(now.getTime() + 60_000));
    const kept = (await ownTitle(target.catalogId))!;
    assert.equal(kept.watchedUndated, false, "a dated entry stays dated");
    assert.equal(kept.impliedRating, null, "stars of their own: no implied rating");
    await undoLastTanda(userId, now);
    assert.ok(await ownTitle(target.catalogId));
  });
});
