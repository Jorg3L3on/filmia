import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  afinaMode,
  chartReason,
  countSignals,
  fallbackReason,
  needsChartFill,
  orderChartFill,
  reachedSignalGoal,
  withReason,
} from "./tonight/cold-start";
import { composeLenses, DECK_SIZE, type ComposableCard, type ComposeLens, type RecoEntry } from "./tonight/compose";
import { itemVector } from "./tonight/features";
import type { TonightGenre, TonightTitle } from "./tonight/types";

const DRAMA: TonightGenre = { id: 18, name: "Drama" };
const COMEDY: TonightGenre = { id: 35, name: "Comedia" };
type Card = ComposableCard & { source: "queue" | "reco" };

const queueCard = (id: string): Card => ({ id, genres: [DRAMA], wildcard: false, pinned: false, reasons: [], source: "queue" });

const chartEntry = (id: string, genre: TonightGenre, calidad: number): RecoEntry<Card> => {
  const title: TonightTitle = {
    id,
    name: id,
    kind: "MOVIE",
    year: 2025,
    runtimeMinutes: 100,
    imdbRating: 7,
    imdbVotes: 1000,
    genres: [genre],
    keywords: [{ id: id.charCodeAt(id.length - 1) * 7, name: id }],
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
  const reason = chartReason({ platform: "NETFLIX", rank: 1, source: "official" });
  return {
    card: { id, genres: [genre], wildcard: false, pinned: false, reasons: [reason], source: "reco" },
    scored: {
      title,
      vector: itemVector(title),
      pick: {
        titleId: id,
        components: { gusto: 0.5, calidad, impulso: 0, novedad: 0, reposo: 0, fatiga: 1 },
        baseScore: 0.25 + 0.35 * calidad,
        reasons: [reason],
        wildcard: false,
      },
    },
  };
};

const chartPool = Array.from({ length: 10 }, (_, index) => chartEntry(`chart-${index}`, index % 2 ? DRAMA : COMEDY, 0.9 - index * 0.05));

/** What getTonightDecks does: the queue lenses, plus the charts only when the queue is thin. */
const deckFor = (queueSize: number) => {
  const queue = Array.from({ length: queueSize }, (_, index) => queueCard(`q${index}`));
  const lenses: ComposeLens<Card>[] = queue.length > 0 ? [{ slug: "para-ti", name: "Para ti", kind: "para-ti", titles: queue }] : [];
  const pool = needsChartFill(queue.length) ? chartPool : [];
  return composeLenses(lenses, pool);
};

describe("signals", () => {
  it("adds rated watches, Quiero ver and taste skips", () => {
    assert.equal(countSignals({ ratedWatched: 2, queue: 3, tasteSkips: 1 }), 6);
    assert.equal(countSignals({ ratedWatched: 0, queue: 0, tasteSkips: 0 }), 0);
    assert.equal(countSignals({ ratedWatched: -1, queue: 2, tasteSkips: 0 }), 2);
  });

  it("shows the meter under 10, one compact card to 40, nothing above", () => {
    assert.equal(afinaMode(0), "full");
    assert.equal(afinaMode(9), "full");
    assert.equal(afinaMode(10), "compact");
    assert.equal(afinaMode(40), "compact");
    assert.equal(afinaMode(41), "hidden");
  });

  it("reaches the goal once, on the answer that crosses 10", () => {
    assert.equal(reachedSignalGoal(9, 10), true);
    assert.equal(reachedSignalGoal(8, 9), false);
    assert.equal(reachedSignalGoal(10, 11), false);
  });
});

describe("deck fill from the charts", () => {
  it("fills an empty queue to a full deck instead of the empty state", () => {
    const lenses = deckFor(0);
    const paraTi = lenses.find((lens) => lens.kind === "para-ti");
    assert.ok(paraTi, "Para ti exists with no queue at all");
    assert.equal(paraTi.titles.length, DECK_SIZE);
    assert.ok(paraTi.titles.every((card) => card.source === "reco"));
  });

  it("tops up a one-title queue, the queue card first", () => {
    const paraTi = deckFor(1).find((lens) => lens.kind === "para-ti")!;
    assert.equal(paraTi.titles.length, DECK_SIZE);
    assert.equal(paraTi.titles[0]!.id, "q0");
    assert.equal(paraTi.titles.filter((card) => card.source === "reco").length, DECK_SIZE - 1);
  });

  it("steps aside once taste recommendations can fill a deck", () => {
    assert.equal(needsChartFill(0, 5), true);
    assert.equal(needsChartFill(0, 6), false);
  });

  it("leaves a three-title queue alone (no chart fill)", () => {
    assert.equal(needsChartFill(3), false);
    const paraTi = deckFor(3).find((lens) => lens.kind === "para-ti")!;
    assert.deepEqual(paraTi.titles.map((card) => card.id), ["q0", "q1", "q2"]);
  });

  it("orders by IMDb, keeps a film once at its best rank", () => {
    const ordered = orderChartFill([
      { catalogId: "a", platform: "MAX", rank: 4, source: "popularity", imdbRating: 7.1 },
      { catalogId: "b", platform: "NETFLIX", rank: 1, source: "official", imdbRating: null },
      { catalogId: "c", platform: "PRIME", rank: 9, source: "popularity", imdbRating: 8.2 },
      { catalogId: "a", platform: "NETFLIX", rank: 2, source: "official", imdbRating: 7.1 },
    ]);
    assert.deepEqual(ordered.map((entry) => `${entry.catalogId}:${entry.platform}:${entry.rank}`), ["c:PRIME:9", "a:NETFLIX:2", "b:NETFLIX:1"]);
  });
});

describe("reasons on every card", () => {
  it("says where a chart title ranks, and never «Top 10» for popularity", () => {
    assert.equal(chartReason({ platform: "MAX", rank: 2, source: "official" }).text, "N.º 2 en HBO Max esta semana");
    assert.equal(chartReason({ platform: "MAX", rank: 2, source: "popularity" }).text, "N.º 2 en lo más popular de HBO Max");
  });

  it("gives a card without reasons a fallback, and keeps existing ones", () => {
    assert.equal(fallbackReason({ source: "reco", imdbRating: 8.1 }).text, "Recomendada · IMDb 8.1");
    assert.equal(fallbackReason({ source: "reco", imdbRating: null }).text, "Recomendada para ti");
    assert.equal(fallbackReason({ source: "queue", imdbRating: null, fromOnboarding: true }).text, "Porque la elegiste al empezar");
    assert.equal(fallbackReason({ source: "queue", imdbRating: null }).text, "Está en tu Quiero ver");
    const kept = { reasons: [chartReason({ platform: "MAX", rank: 1, source: "official" })], source: "reco" as const, imdbRating: 7 };
    assert.equal(withReason(kept), kept);
    const cards = deckFor(1).flatMap((lens) => lens.titles).map((card) => withReason({ ...card, imdbRating: null }));
    assert.ok(cards.every((card) => card.reasons.length > 0), "every deck card carries a reason");
  });
});
