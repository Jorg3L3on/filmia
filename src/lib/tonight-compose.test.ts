import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeLenses,
  DECK_SIZE,
  interleaveBySource,
  type ComposableCard,
  type ComposeLens,
  type RecoEntry,
} from "./tonight/compose";
import { itemVector } from "./tonight/features";
import type { TonightGenre, TonightTitle } from "./tonight/types";

const DRAMA: TonightGenre = { id: 18, name: "Drama" };
const SCIFI: TonightGenre = { id: 878, name: "Ciencia ficción" };
const COMEDY: TonightGenre = { id: 35, name: "Comedia" };
const HORROR: TonightGenre = { id: 27, name: "Terror" };

type Card = ComposableCard & { source: "queue" | "reco" };

const queueCard = (id: string, genres: TonightGenre[], overrides: Partial<Card> = {}): Card => ({
  id,
  genres,
  wildcard: false,
  pinned: false,
  reasons: [],
  source: "queue",
  ...overrides,
});

const recoEntry = (
  id: string,
  genres: TonightGenre[],
  score: number,
  options: { gusto?: number; calidad?: number } = {},
): RecoEntry<Card> => {
  const title: TonightTitle = {
    id,
    name: id,
    kind: "MOVIE",
    year: 2020,
    runtimeMinutes: 110,
    imdbRating: 7.5,
    imdbVotes: 100_000,
    genres,
    keywords: [{ id: id.length * 1000 + id.charCodeAt(id.length - 1), name: id }],
    people: [],
    originalLanguage: "en",
    platform: null,
    flatrate: [],
    availableOnMine: true,
    watchedAt: null,
    rating: null,
    review: null,
    seriesStatus: null,
    seriesSeason: null,
    listSlugs: [],
    availableSince: null,
    createdAt: new Date(2026, 0, 1),
  };
  return {
    card: { id, genres, wildcard: false, pinned: false, reasons: [], source: "reco" },
    scored: {
      title,
      vector: itemVector(title),
      pick: {
        titleId: id,
        components: {
          gusto: options.gusto ?? 0.6,
          calidad: options.calidad ?? 0.6,
          impulso: 0,
          novedad: 0,
          reposo: 0,
          fatiga: 1,
        },
        baseScore: score,
        reasons: [],
        wildcard: false,
      },
    },
  };
};

const lens = (
  slug: string,
  name: string,
  kind: "para-ti" | "genre",
  titles: Card[],
): ComposeLens<Card> => ({ slug, name, kind, titles });

const ids = (item: ComposeLens<Card> | undefined) => item?.titles.map((card) => card.id) ?? [];
const recoIds = (item: ComposeLens<Card> | undefined) =>
  item?.titles.filter((card) => card.source === "reco").map((card) => card.id) ?? [];
const queueIds = (item: ComposeLens<Card> | undefined) =>
  item?.titles.filter((card) => card.source === "queue").map((card) => card.id) ?? [];

const pool = (): RecoEntry<Card>[] => [
  recoEntry("r-drama-1", [DRAMA], 0.9),
  recoEntry("r-drama-2", [DRAMA, SCIFI], 0.85),
  recoEntry("r-scifi-1", [SCIFI], 0.8),
  recoEntry("r-scifi-2", [SCIFI], 0.75),
  recoEntry("r-comedy-1", [COMEDY], 0.7, { gusto: 0.2, calidad: 0.9 }),
  recoEntry("r-comedy-2", [COMEDY], 0.65),
  recoEntry("r-comedy-3", [COMEDY], 0.6),
  recoEntry("r-scifi-3", [SCIFI], 0.55),
];

describe("tonight/compose", () => {
  it("shows three from Quiero ver and three recommended, the wildcard among the latter", () => {
    const wildcardQueue = queueCard("q-wild", [HORROR], { wildcard: true });
    const lenses = [
      lens("para-ti", "Para ti", "para-ti", [
        queueCard("q1", [DRAMA]),
        queueCard("q2", [SCIFI]),
        queueCard("q3", [COMEDY]),
        queueCard("q4", [DRAMA]),
        wildcardQueue,
      ]),
    ];
    const [paraTi] = composeLenses(lenses, pool());
    assert.equal(paraTi!.titles.length, DECK_SIZE);
    assert.deepEqual(queueIds(paraTi), ["q1", "q2", "q3"], "the queue wildcard gives way");
    assert.equal(recoIds(paraTi).length, 3);
    const wild = paraTi!.titles.filter((card) => card.wildcard);
    assert.equal(wild.length, 1);
    assert.equal(wild[0]!.source, "reco");
    assert.equal(wild[0]!.reasons[0]?.kind, "wildcard");
    assert.equal(wild[0]!.id, "r-comedy-1", "the good film furthest from your taste");
  });

  it("gives a genre lens only recommendations of that genre and never repeats a film", () => {
    const lenses = [
      lens("para-ti", "Para ti", "para-ti", [queueCard("q1", [DRAMA]), queueCard("q2", [DRAMA]), queueCard("q3", [DRAMA])]),
      lens("ciencia-ficcion-878", "Ciencia ficción", "genre", [
        queueCard("q4", [SCIFI]),
        queueCard("q5", [SCIFI]),
        queueCard("q6", [SCIFI]),
      ]),
    ];
    const composed = composeLenses(lenses, pool());
    const scifi = composed.find((item) => item.slug === "ciencia-ficcion-878");
    const scifiPool = new Set(["r-drama-2", "r-scifi-1", "r-scifi-2", "r-scifi-3"]);
    assert.ok(recoIds(scifi).length > 0);
    assert.ok(recoIds(scifi).every((id) => scifiPool.has(id)));
    const all = composed.flatMap((item) => ids(item));
    assert.equal(new Set(all).size, all.length, "no film twice across lenses");
  });

  it("tops a short queue up with recommendations to a full deck", () => {
    const lenses = [lens("para-ti", "Para ti", "para-ti", [queueCard("q1", [DRAMA])])];
    const [paraTi] = composeLenses(lenses, pool());
    assert.equal(queueIds(paraTi).length, 1);
    assert.equal(paraTi!.titles.length, DECK_SIZE);
    assert.equal(recoIds(paraTi).length, 5);
  });

  it("leaves the lenses exactly as they were when there is nothing recommended", () => {
    const lenses = [
      lens("para-ti", "Para ti", "para-ti", [
        queueCard("q1", [DRAMA]),
        queueCard("q2", [DRAMA]),
        queueCard("q3", [DRAMA]),
        queueCard("q4", [DRAMA]),
        queueCard("q-wild", [HORROR], { wildcard: true }),
      ]),
    ];
    const composed = composeLenses(lenses, []);
    assert.deepEqual(ids(composed[0]), ["q1", "q2", "q3", "q4", "q-wild"]);
  });

  it("falls back to the queue it had when a lens finds too few recommendations", () => {
    const lenses = [
      lens("para-ti", "Para ti", "para-ti", [
        queueCard("q1", [DRAMA]),
        queueCard("q2", [DRAMA]),
        queueCard("q3", [DRAMA]),
      ]),
      lens("terror-27", "Terror", "genre", [
        queueCard("h1", [HORROR]),
        queueCard("h2", [HORROR]),
        queueCard("h3", [HORROR]),
        queueCard("h4", [HORROR]),
        queueCard("h5", [HORROR]),
      ]),
    ];
    // Only one horror film is recommended, and it is not good enough for Para ti.
    const entries = [recoEntry("r-h", [HORROR], 0.3, { gusto: 0.9 }), ...pool()];
    const horror = composeLenses(lenses, entries).find((item) => item.slug === "terror-27");
    assert.equal(horror!.titles.length, DECK_SIZE);
    assert.deepEqual(recoIds(horror), ["r-h"]);
    assert.equal(queueIds(horror).length, 5, "the spare queue fills the gap");
  });

  it("keeps a lens as it was when nothing recommended belongs to it", () => {
    const lenses = [
      lens("terror-27", "Terror", "genre", [queueCard("h1", [HORROR]), queueCard("h2", [HORROR])]),
    ];
    const horror = composeLenses(lenses, pool()).find((item) => item.slug === "terror-27");
    assert.deepEqual(ids(horror), ["h1", "h2"]);
  });

  it("keeps the pinned film first and counts it as one of the three from the queue", () => {
    const lenses = [
      lens("para-ti", "Para ti", "para-ti", [
        queueCard("pin", [DRAMA], { pinned: true }),
        queueCard("q1", [DRAMA]),
        queueCard("q2", [DRAMA]),
        queueCard("q3", [DRAMA]),
      ]),
    ];
    const [paraTi] = composeLenses(lenses, pool());
    assert.equal(paraTi!.titles[0]!.id, "pin");
    assert.deepEqual(queueIds(paraTi), ["pin", "q1", "q2"]);
    assert.equal(recoIds(paraTi).length, 3);
  });

  it("builds the whole deck from recommendations when Quiero ver has nothing to show", () => {
    const big = [
      ...pool(),
      recoEntry("r-drama-3", [DRAMA], 0.5),
      recoEntry("r-drama-4", [DRAMA], 0.48),
      recoEntry("r-comedy-4", [COMEDY], 0.45),
      recoEntry("r-horror-1", [HORROR], 0.44),
      recoEntry("r-horror-2", [HORROR], 0.43),
      recoEntry("r-horror-3", [HORROR], 0.42),
      recoEntry("r-horror-4", [HORROR], 0.41),
    ];
    const composed = composeLenses<Card>([], big);
    assert.equal(composed[0]!.slug, "para-ti");
    assert.ok(composed[0]!.titles.length > 0);
    assert.ok(composed.every((item) => item.titles.every((card) => card.source === "reco")));
    const genreLenses = composed.filter((item) => item.kind === "genre");
    assert.ok(genreLenses.length >= 1, "genres the recommendations lean on open their own lens");
    const all = composed.flatMap((item) => ids(item));
    assert.equal(new Set(all).size, all.length);
  });

  it("alternates queue and recommended, pinned first, wildcard last", () => {
    const ranked: Card[] = [
      queueCard("q1", []),
      queueCard("q2", []),
      queueCard("q3", []),
      { ...queueCard("r1", []), source: "reco" },
      { ...queueCard("r2", []), source: "reco" },
      { ...queueCard("r3", []), source: "reco" },
      { ...queueCard("rw", []), source: "reco", wildcard: true },
      queueCard("pin", [], { pinned: true }),
    ];
    assert.deepEqual(
      interleaveBySource(ranked).map((card) => card.id),
      ["pin", "q1", "r1", "q2", "r2", "q3", "r3", "rw"],
    );
  });
});
