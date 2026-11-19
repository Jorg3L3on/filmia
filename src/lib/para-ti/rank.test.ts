import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Platform } from "@/db/schema";
import { STREAMING_PLATFORM_TMDB } from "@/lib/streaming-platforms";
import {
  DEFAULT_FILTERS,
  dailySeed,
  filtersToParams,
  parseFilters,
  qualityOf,
  rankParaTi,
  type ParaTiCandidate,
  type RankContext,
} from "./rank";
import { buildShelves, pickAnchor, SHELF_MIN, type AnchorCandidate } from "./shelves";

const offer = (platform: Platform) => ({
  providerId: STREAMING_PLATFORM_TMDB[platform].providerIds[0]!,
  name: platform,
  logoPath: null,
  logoUrl: null,
});

let seq = 0;
const film = (extra: Partial<ParaTiCandidate> = {}): ParaTiCandidate => {
  seq += 1;
  return {
    catalogId: `c${String(seq).padStart(4, "0")}`,
    tmdbId: seq,
    kind: "MOVIE",
    name: `Película ${seq}`,
    year: 2015,
    posterPath: `/p${seq}.jpg`,
    posterAmbient: null,
    runtimeMinutes: 100,
    imdbRating: null,
    imdbVotes: null,
    rtScore: null,
    voteAverage: 7,
    voteCount: 800,
    poolRank: seq % 100,
    genres: [{ id: 35, name: "Comedia" }],
    keywords: [],
    people: [],
    originalLanguage: "es",
    providers: { link: null, flatrate: [offer("NETFLIX")], rent: [], buy: [] },
    availableSince: null,
    ...extra,
  };
};

const context = (extra: Partial<RankContext> = {}): RankContext => ({
  excluded: new Set(),
  userPlatforms: ["NETFLIX"],
  filters: DEFAULT_FILTERS,
  scorer: null,
  seed: "u1:2026-11-17",
  ...extra,
});

describe("rankParaTi (FIL-I60-3)", () => {
  it("leaves out excluded titles (owned or dismissed) and posterless ones", () => {
    const [watched, queued, dropped, dismissed, free] = [film(), film(), film(), film(), film()];
    const noPoster = film({ posterPath: null });
    const out = rankParaTi([watched!, queued!, dropped!, dismissed!, free!, noPoster], context({
      excluded: new Set([watched!.catalogId, queued!.catalogId, dropped!.catalogId, dismissed!.catalogId]),
    }));
    assert.deepEqual(out.map((title) => title.catalogId), [free!.catalogId]);
  });

  it("with «Solo mis plataformas» keeps only titles on the user's platforms; off, shows the rest", () => {
    const mine = film();
    const elsewhere = film({ providers: { link: null, flatrate: [offer("DISNEY")], rent: [], buy: [] } });
    const unknown = film({ providers: null });
    const on = rankParaTi([mine, elsewhere, unknown], context());
    assert.deepEqual(on.map((title) => title.catalogId), [mine.catalogId]);
    assert.equal(on[0]?.platform, "NETFLIX");
    const off = rankParaTi([mine, elsewhere, unknown], context({ filters: { ...DEFAULT_FILTERS, onlyMine: false } }));
    assert.equal(off.length, 3);
    // No platforms saved: the switch cannot apply, everything shows.
    assert.equal(rankParaTi([mine, elsewhere], context({ userPlatforms: [] })).length, 2);
  });

  it("narrows by kind, era and runtime, and the filters combine", () => {
    const movie90s = film({ year: 1994, runtimeMinutes: 88 });
    const movie2010s = film({ year: 2012, runtimeMinutes: 130 });
    const series2020s = film({ kind: "SERIES", year: 2021, runtimeMinutes: 45 });
    const unknownRuntime = film({ year: 1996, runtimeMinutes: null });
    const all = [movie90s, movie2010s, series2020s, unknownRuntime];
    const ids = (filters: Partial<typeof DEFAULT_FILTERS>) =>
      rankParaTi(all, context({ filters: { ...DEFAULT_FILTERS, ...filters } })).map((title) => title.catalogId).sort();
    assert.deepEqual(ids({ kind: "SERIES" }), [series2020s.catalogId]);
    assert.deepEqual(ids({ kind: "MOVIE" }), [movie90s, movie2010s, unknownRuntime].map((f) => f.catalogId).sort());
    assert.deepEqual(ids({ era: "1990s" }), [movie90s.catalogId, unknownRuntime.catalogId].sort());
    assert.deepEqual(ids({ maxRuntime: 90 }), [movie90s.catalogId, series2020s.catalogId].sort());
    assert.deepEqual(ids({ era: "1990s", maxRuntime: 90 }), [movie90s.catalogId]);
    assert.deepEqual(ids({ kind: "SERIES", era: "1990s" }), []);
  });

  it("returns the same order for the same input, and quality leads at cold start", () => {
    const pool = Array.from({ length: 30 }, (_, index) => film({ voteAverage: 5.5 + (index % 10) * 0.4, voteCount: 2000 }));
    const first = rankParaTi(pool, context());
    const second = rankParaTi([...pool].reverse(), context());
    assert.deepEqual(first.map((title) => title.catalogId), second.map((title) => title.catalogId));
    assert.ok(first.every((title) => title.affinity === null), "cold start shows no affinity level");
    const quality = first.map((title) => pool.find((item) => item.catalogId === title.catalogId)!.voteAverage!);
    assert.ok(quality[0]! >= quality[quality.length - 1]!, "best rated first");
  });

  it("moves a little from one day to the next", () => {
    const pool = Array.from({ length: 30 }, () => film({ voteAverage: 7, voteCount: 2000 }));
    const today = rankParaTi(pool, context({ seed: dailySeed("u1", new Date("2026-11-17T18:00:00Z")) }));
    const tomorrow = rankParaTi(pool, context({ seed: dailySeed("u1", new Date("2026-11-18T18:00:00Z")) }));
    assert.notDeepEqual(today.map((t) => t.catalogId), tomorrow.map((t) => t.catalogId));
  });

  it("rates quality from IMDb when solid, else TMDB shrunk by votes", () => {
    assert.ok(qualityOf({ imdbRating: 8.5, imdbVotes: 50_000, voteAverage: 6, voteCount: 10 }) > 0.8);
    assert.ok(qualityOf({ imdbRating: null, imdbVotes: null, voteAverage: 9, voteCount: 5 }) < 0.4);
  });

  it("reads and writes its filters from the URL", () => {
    const filters = parseFilters({ tipo: "serie", epoca: "1990s", duracion: "90", todas: "1" });
    assert.deepEqual(filters, { kind: "SERIES", era: "1990s", maxRuntime: 90, onlyMine: false });
    assert.deepEqual(filtersToParams(filters), { tipo: "serie", epoca: "1990s", duracion: "90", todas: "1" });
    assert.deepEqual(parseFilters({ tipo: "x", epoca: "1880s", duracion: "77" }), DEFAULT_FILTERS);
    assert.deepEqual(filtersToParams(DEFAULT_FILTERS), {});
  });
});

describe("Para ti shelves (FIL-I60-3)", () => {
  const now = new Date("2026-11-17T18:00:00Z");

  it("at cold start shows «Lo mejor valorado» instead of «Porque te gustó…», and omits thin shelves", () => {
    const pool = Array.from({ length: 12 }, () => film());
    const joyas = [film(), film()]; // fewer than SHELF_MIN
    const arrivals = Array.from({ length: 5 }, (_, index) => film({ availableSince: new Date(now.getTime() - index * 86_400_000) }));
    const shelves = buildShelves({ pool, joyas, arrivals, anchor: null, related: new Set(), now }, context());
    assert.deepEqual(shelves.map((shelf) => shelf.id), ["mejor", "nuevo"]);
    assert.equal(shelves[0]?.title, "Lo mejor valorado");
    assert.ok(shelves.every((shelf) => shelf.titles.length >= SHELF_MIN));
    // Newest arrival first.
    assert.equal(shelves[1]?.titles[0]?.catalogId, arrivals[0]?.catalogId);
  });

  it("«Nuevo en tus plataformas» keeps the last 90 days and the user's platforms only", () => {
    const old = film({ availableSince: new Date(now.getTime() - 200 * 86_400_000) });
    const elsewhere = film({
      availableSince: now,
      providers: { link: null, flatrate: [offer("DISNEY")], rent: [], buy: [] },
    });
    const fresh = Array.from({ length: 4 }, () => film({ availableSince: now }));
    const shelves = buildShelves(
      { pool: [], joyas: [], arrivals: [old, elsewhere, ...fresh], anchor: null, related: new Set(), now },
      context({ filters: { ...DEFAULT_FILTERS, onlyMine: false } }),
    );
    const nuevo = shelves.find((shelf) => shelf.id === "nuevo");
    assert.equal(nuevo?.titles.length, 4);
    assert.ok(!nuevo?.titles.some((title) => title.catalogId === old.catalogId || title.catalogId === elsewhere.catalogId));
  });

  it("picks the day's anchor among the best-rated watched titles, the same all day", () => {
    const title = (name: string, rating: number | null, watched = true) => ({
      tmdbId: seq++,
      kind: "MOVIE" as const,
      title: {
        id: name,
        name,
        kind: "MOVIE" as const,
        year: 2010,
        runtimeMinutes: null,
        imdbRating: null,
        imdbVotes: null,
        genres: [],
        keywords: [],
        people: [],
        originalLanguage: null,
        platform: null,
        flatrate: [],
        availableOnMine: false,
        watchedAt: watched ? new Date("2026-01-01") : null,
        rating,
        review: null,
        seriesStatus: null,
        seriesSeason: null,
        listSlugs: [],
        availableSince: null,
        createdAt: new Date(0),
      },
    }) satisfies AnchorCandidate;
    const library = [title("Baja", 6), title("Alta", 9.5), title("Sin ver", 10, false)];
    assert.equal(pickAnchor(library, "u1:2026-11-17")?.title.name, "Alta");
    assert.equal(pickAnchor([title("Baja", 5)], "u1:2026-11-17"), null);
    const many = Array.from({ length: 8 }, (_, index) => title(`T${index}`, 8 + (index % 3)));
    assert.equal(pickAnchor(many, "u1:2026-11-17")?.title.name, pickAnchor(many, "u1:2026-11-17")?.title.name);
  });
});
