import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { genresInList, languagesInList, peopleInList, toWatchlistRow, type WatchlistRowSource } from "@/lib/watchlist-rows";

const offer = (providerId: number, name: string) => ({ providerId, name, logoPath: null });

const source = (overrides: Partial<WatchlistRowSource["title"]> = {}, item: Partial<WatchlistRowSource> = {}): WatchlistRowSource => ({
  addedAt: "2026-10-01T00:00:00Z",
  queueNote: null,
  ...item,
  title: {
    id: "t1",
    name: "Fuego lento",
    kind: "MOVIE",
    seriesStatus: null,
    platform: null,
    runtimeMinutes: 86,
    year: 1999,
    imdbRating: 7.5,
    imdbVotes: 3000,
    awards: null,
    tmdbGenres: [{ id: 18, name: "Drama" }],
    tmdbPeople: [
      { id: 7, name: "Marina Ocampo", role: "director" },
      { id: 8, name: "Tomás Valdivia", role: "cast" },
    ],
    originalLanguage: "ES",
    availableSince: null,
    watchProvidersMx: {
      link: null,
      flatrate: [offer(8, "Netflix")],
      rent: [offer(9, "Amazon Prime Video")],
      buy: [],
    },
    ...overrides,
  },
});

const options = { userPlatforms: ["NETFLIX" as const], snoozedIds: new Set<string>() };

describe("watchlist-rows/toWatchlistRow", () => {
  it("maps providers, people, language and personal flags", () => {
    const row = toWatchlistRow(source({}, { queueNote: "  con Ana " }), { ...options, snoozedIds: new Set(["t1"]) });
    assert.deepEqual(row.flatrate, ["NETFLIX"]);
    assert.deepEqual(row.rentBuy, ["PRIME"]);
    assert.equal(row.onMine, true);
    assert.equal(row.providersUnknown, false);
    assert.deepEqual(row.people, [7]);
    assert.equal(row.language, "es");
    assert.equal(row.hasNote, true);
    assert.equal(row.snoozed, true);
    assert.equal(row.addedAt, Date.parse("2026-10-01T00:00:00Z"));
  });

  it("falls back to the saved platform when TMDB never answered", () => {
    const saved = toWatchlistRow(source({ watchProvidersMx: null, platform: "NETFLIX" }), options);
    assert.deepEqual(saved.flatrate, ["NETFLIX"]);
    assert.equal(saved.onMine, true);
    const unknown = toWatchlistRow(source({ watchProvidersMx: null }), options);
    assert.equal(unknown.providersUnknown, true);
    assert.equal(unknown.onMine, false);
  });

  it("uses creators for series", () => {
    const row = toWatchlistRow(source({ kind: "SERIES", tmdbPeople: [{ id: 3, name: "Inés Carrasco", role: "creator" }, { id: 7, name: "Marina Ocampo", role: "director" }] }), options);
    assert.deepEqual(row.people, [3]);
  });
});

describe("watchlist-rows/names", () => {
  it("counts genres, people and languages over the list", () => {
    const items = [source(), source({ id: "t2", tmdbGenres: [{ id: 18, name: "Drama" }, { id: 99, name: "Documental" }], originalLanguage: "ja" })];
    assert.deepEqual(genresInList(items), [{ id: 18, name: "Drama", count: 2 }, { id: 99, name: "Documental", count: 1 }]);
    assert.deepEqual(peopleInList(items), [{ id: 7, name: "Marina Ocampo", count: 2 }]);
    assert.deepEqual(languagesInList(items.map((item) => toWatchlistRow(item, options))), [{ code: "es", count: 1 }, { code: "ja", count: 1 }]);
  });
});
