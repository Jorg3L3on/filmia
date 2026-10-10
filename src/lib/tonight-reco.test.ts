import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogIdFor } from "./catalog-core";
import {
  blockedItemIds,
  candidateKey,
  discoverKinds,
  excludeCandidates,
  mergeCandidates,
  pickSeeds,
  prefilterCandidates,
  SEED_LIKED_CAP,
  SEED_QUEUE_CAP,
  topGenreIds,
  type LibraryRef,
  type ListedTitle,
} from "./tonight/candidates";
import { eventItemId, toTonightEvents } from "./tonight/events";
import { buildTasteProfile, withQueueTaste } from "./tonight/profile";
import { scoreRecos, type RecoInput } from "./tonight/reco";
import type { RecoCandidate, TonightEvent, TonightQueueEntry, TonightTitle } from "./tonight/types";

const NOW = new Date(2026, 9, 10, 21, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const DRAMA = { id: 18, name: "Drama" };
const SCIFI = { id: 878, name: "Ciencia ficción" };
const COMEDY = { id: 35, name: "Comedia" };

const title = (id: string, overrides: Partial<TonightTitle> = {}): TonightTitle => ({
  id,
  name: id,
  kind: "MOVIE",
  year: 2014,
  runtimeMinutes: 120,
  imdbRating: 7.5,
  imdbVotes: 200_000,
  genres: [DRAMA],
  keywords: [],
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
  createdAt: new Date(NOW.getTime() - 200 * DAY),
  ...overrides,
});

const entry = (titleId: string, position: number, daysAgo = 10): TonightQueueEntry => ({
  titleId,
  position,
  addedAt: new Date(NOW.getTime() - daysAgo * DAY),
  queueNote: null,
});

const refs = (ids: string[]): Map<string, LibraryRef> =>
  new Map(ids.map((id, index) => [id, { tmdbId: 1000 + index, catalogId: `cat-${id}` }]));

const listed = (tmdbId: number, overrides: Partial<ListedTitle> = {}): ListedTitle => ({
  tmdbId,
  kind: "MOVIE",
  name: `Peli ${tmdbId}`,
  originalName: null,
  year: 2020,
  posterPath: null,
  backdropPath: null,
  overview: null,
  voteAverage: 7.2,
  voteCount: 5000,
  genreIds: [18],
  ...overrides,
});

describe("tonight/events", () => {
  it("keys an event by the user's title when they own the film, else by the film", () => {
    const owned = new Map([["cat-1", "title-1"]]);
    assert.equal(eventItemId({ titleId: null, catalogId: "cat-1" }, owned), "title-1");
    assert.equal(eventItemId({ titleId: null, catalogId: "cat-2" }, owned), "cat-2");
    // Written before 0011: only a title id.
    assert.equal(eventItemId({ titleId: "title-9", catalogId: null }, owned), "title-9");
    assert.equal(eventItemId({ titleId: null, catalogId: null }, owned), null);
  });

  it("drops rows with no id or an unknown kind", () => {
    const events = toTonightEvents(
      [
        { titleId: null, catalogId: "cat-2", kind: "less_like", createdAt: NOW },
        { titleId: null, catalogId: null, kind: "shown", createdAt: NOW },
        { titleId: "t", catalogId: null, kind: "bogus", createdAt: NOW },
      ],
      new Map(),
    );
    assert.deepEqual(
      events.map((event) => [event.titleId, event.kind]),
      [["cat-2", "less_like"]],
    );
  });
});

describe("tonight/candidates", () => {
  it("seeds from the head of Quiero ver, then liked watches, capped and without duplicates", () => {
    const queued = Array.from({ length: 20 }, (_, index) => title(`q${index}`));
    const liked = Array.from({ length: 50 }, (_, index) =>
      title(`w${index}`, { watchedAt: new Date(NOW.getTime() - index * DAY), rating: 8 }),
    );
    const meh = title("meh", { watchedAt: NOW, rating: 5 });
    const dropped = title("dropped", {
      kind: "SERIES",
      seriesStatus: "DROPPED",
      watchedAt: NOW,
      rating: 9,
    });
    const titles = [...queued, ...liked, meh, dropped];
    const seeds = pickSeeds({
      titles,
      queue: queued.map((item, index) => entry(item.id, index)),
      refs: refs(titles.map((item) => item.id)),
    });
    assert.equal(seeds.filter((seed) => seed.via === "queue").length, SEED_QUEUE_CAP);
    assert.equal(seeds.filter((seed) => seed.via === "watched").length, SEED_LIKED_CAP);
    assert.deepEqual(
      seeds.slice(0, 2).map((seed) => seed.titleId),
      ["q0", "q1"],
    );
    assert.ok(!seeds.some((seed) => seed.titleId === "meh" || seed.titleId === "dropped"));
    assert.equal(new Set(seeds.map((seed) => seed.titleId)).size, seeds.length);
  });

  it("needs a TMDB id to seed", () => {
    const queued = [title("q0"), title("q1")];
    const seeds = pickSeeds({
      titles: queued,
      queue: queued.map((item, index) => entry(item.id, index)),
      refs: refs(["q1"]),
    });
    assert.deepEqual(seeds.map((seed) => seed.titleId), ["q1"]);
  });

  it("opens a discover pool per kind that has enough seeds, else the most common kind", () => {
    const seed = (kind: "MOVIE" | "SERIES", index: number) => ({
      titleId: `${kind}${index}`,
      catalogId: `c${index}`,
      tmdbId: index,
      kind,
      name: "x",
      via: "queue" as const,
      rating: null,
    });
    const mixed = [...[1, 2, 3, 4].map((n) => seed("MOVIE", n)), ...[5, 6, 7].map((n) => seed("SERIES", n))];
    assert.deepEqual(discoverKinds(mixed).sort(), ["MOVIE", "SERIES"]);
    assert.deepEqual(discoverKinds([seed("SERIES", 1), seed("SERIES", 2)]), ["SERIES"]);
    assert.deepEqual(discoverKinds([]), ["MOVIE"]);
  });

  it("takes the strongest positive genres", () => {
    const affinity = new Map([[18, 3], [35, 1], [878, 2], [27, -1], [10, 0]]);
    assert.deepEqual(topGenreIds(affinity, 2), [18, 878]);
  });

  it("merges one entry per film and remembers every source", () => {
    const seed = {
      titleId: "q0",
      catalogId: "cat-q0",
      tmdbId: 1,
      kind: "MOVIE" as const,
      name: "Q",
      via: "queue" as const,
      rating: null,
    };
    const merged = mergeCandidates([
      { items: [listed(10), listed(11)], sourceKind: "recommendations", seed },
      { items: [listed(10)], sourceKind: "discover", seed: null },
      { items: [listed(10)], sourceKind: "recommendations", seed },
    ]);
    assert.equal(merged.size, 2);
    const first = merged.get(candidateKey("MOVIE", 10))!;
    assert.equal(first.catalogId, catalogIdFor("MOVIE", 10));
    assert.equal(first.sources.length, 2);
  });

  it("excludes the whole library and what the user pushed away", () => {
    const merged = mergeCandidates([
      { items: [listed(1), listed(2), listed(3), listed(4)], sourceKind: "discover", seed: null },
    ]);
    const kept = excludeCandidates(merged, {
      libraryKeys: new Set([candidateKey("MOVIE", 1)]),
      blockedIds: new Set([catalogIdFor("MOVIE", 2)]),
    });
    assert.deepEqual([...kept.keys()].sort(), [candidateKey("MOVIE", 3), candidateKey("MOVIE", 4)]);
  });

  it("blocks «Menos así» for good and «Ahora no» for two weeks", () => {
    const event = (titleId: string, kind: TonightEvent["kind"], daysAgo: number): TonightEvent => ({
      titleId,
      kind,
      createdAt: new Date(NOW.getTime() - daysAgo * DAY),
    });
    const blocked = blockedItemIds(
      [
        event("a", "less_like", 25),
        event("b", "not_tonight", 3),
        event("c", "not_tonight", 20),
        event("d", "shown", 1),
      ],
      NOW,
    );
    assert.deepEqual([...blocked].sort(), ["a", "b"]);
  });

  it("pre-ranks by taste and drops low-vote noise before the expensive step", () => {
    const merged = mergeCandidates([
      {
        items: [
          listed(1, { genreIds: [18] }),
          listed(2, { genreIds: [35] }),
          listed(3, { genreIds: [18], voteCount: 10 }),
        ],
        sourceKind: "discover",
        seed: null,
      },
    ]);
    const ranked = prefilterCandidates(merged, new Map([[18, 3], [35, 0.2]]), 10);
    assert.deepEqual(ranked.map((candidate) => candidate.tmdbId), [1, 2]);
    assert.equal(prefilterCandidates(merged, new Map([[18, 3]]), 1).length, 1);
  });
});

describe("tonight/reco", () => {
  const candidateOf = (
    tmdbId: number,
    seedTitle?: TonightTitle,
    via: "queue" | "watched" = "queue",
  ): RecoCandidate => {
    const merged = mergeCandidates([
      {
        items: [listed(tmdbId)],
        sourceKind: seedTitle ? "recommendations" : "discover",
        seed: seedTitle
          ? {
              titleId: seedTitle.id,
              catalogId: `cat-${seedTitle.id}`,
              tmdbId: 1,
              kind: "MOVIE",
              name: seedTitle.name,
              via,
              rating: seedTitle.rating,
            }
          : null,
      },
    ]);
    return merged.get(candidateKey("MOVIE", tmdbId))!;
  };

  it("recommends to someone with no watches and a few saved films", () => {
    const queued = [
      title("Arrival", { name: "Arrival", genres: [SCIFI, DRAMA] }),
      title("Her", { name: "Her", genres: [SCIFI, DRAMA] }),
      title("Moon", { name: "Moon", genres: [SCIFI] }),
    ];
    const queue = queued.map((item, index) => entry(item.id, index));
    const plain = buildTasteProfile(queued, [], NOW);
    assert.equal(plain.vector.size, 0, "no watches means no taste of its own");

    const profile = withQueueTaste(
      plain,
      queue.map((item) => ({ title: queued.find((t) => t.id === item.titleId)!, addedAt: item.addedAt })),
      NOW,
    );
    assert.ok(profile.vector.size > 0, "the saved films give a taste");
    assert.deepEqual(topGenreIds(profile.genreAffinity, 1), [878]);

    const near = title("cat-near", { name: "Interstellar", genres: [SCIFI, DRAMA] });
    const far = title("cat-far", { name: "Comedieta", genres: [COMEDY] });
    const inputs: RecoInput[] = [
      { candidate: { ...candidateOf(50, queued[0]), catalogId: "cat-near" }, title: near },
      { candidate: { ...candidateOf(51), catalogId: "cat-far" }, title: far },
    ];
    const picks = scoreRecos({
      inputs,
      profile,
      titlesById: new Map(queued.map((item) => [item.id, item])),
      events: [],
      now: NOW,
    });

    assert.equal(picks.length, 2);
    assert.equal(picks[0]!.catalogId, "cat-near", "the one that looks like the queue comes first");
    const reason = picks[0]!.reasons.find((item) => item.kind === "reco_seed");
    assert.equal(reason?.text, "Porque tienes Arrival en Quiero ver");
    assert.match(reason?.detail ?? "", /^Comparten /);
    assert.equal(picks[0]!.sourceKind, "recommendations");
    assert.equal(picks[0]!.seed?.titleId, "Arrival");
    assert.equal(picks[0]!.titleId, "cat-near", "a recommendation is keyed by its film");
  });

  it("explains a seed you rated, without repeating the generic anchor", () => {
    const seed = title("Parasite", {
      name: "Parasite",
      genres: [DRAMA],
      watchedAt: new Date(NOW.getTime() - 30 * DAY),
      rating: 9,
    });
    const profile = buildTasteProfile([seed], [], NOW);
    const candidate = { ...candidateOf(60, seed, "watched"), catalogId: "cat-60" };
    const [pick] = scoreRecos({
      inputs: [{ candidate, title: title("cat-60", { name: "Burning", genres: [DRAMA] }) }],
      profile,
      titlesById: new Map([[seed.id, seed]]),
      events: [],
      now: NOW,
    });
    const texts = pick!.reasons.map((item) => item.text);
    assert.ok(texts.includes("Porque le diste 4.5★ a Parasite"));
    assert.equal(texts.filter((text) => text.includes("Parasite")).length, 1);
    assert.equal(pick!.reasons[0]!.kind, "reco_seed", "the seed leads the headline");
  });

  it("does not explain a pick with a lukewarm watch", () => {
    const lukewarm = title("Sacrificio", {
      name: "Sacrificio",
      genres: [DRAMA],
      watchedAt: new Date(NOW.getTime() - 30 * DAY),
      rating: 7,
    });
    const profile = buildTasteProfile([lukewarm], [], NOW);
    const [pick] = scoreRecos({
      inputs: [
        {
          candidate: { ...candidateOf(65, lukewarm, "watched"), catalogId: "cat-65" },
          title: title("cat-65", { genres: [DRAMA] }),
        },
      ],
      profile,
      titlesById: new Map([[lukewarm.id, lukewarm]]),
      events: [],
      now: NOW,
    });
    assert.equal(pick!.seed, null);
    assert.ok(!pick!.reasons.some((item) => item.text.includes("Sacrificio") && item.kind === "reco_seed"));
    // It still came from /recommendations, only the story is the genre.
    assert.equal(pick!.sourceKind, "recommendations");
  });

  it("falls back to the genre when no seed led here", () => {
    const profile = withQueueTaste(
      buildTasteProfile([], [], NOW),
      [{ title: title("q0", { genres: [DRAMA] }), addedAt: NOW }],
      NOW,
    );
    const [pick] = scoreRecos({
      inputs: [{ candidate: { ...candidateOf(70), catalogId: "cat-70" }, title: title("cat-70", { genres: [DRAMA] }) }],
      profile,
      titlesById: new Map(),
      events: [],
      now: NOW,
    });
    assert.equal(pick!.seed, null);
    assert.equal(pick!.sourceKind, "discover");
    assert.equal(pick!.reasons.find((item) => item.kind === "reco_genre")?.text, "Va con lo que sueles guardar: Drama");
  });

  it("wears down a recommendation that keeps being shown and skipped", () => {
    const profile = withQueueTaste(
      buildTasteProfile([], [], NOW),
      [{ title: title("q0"), addedAt: NOW }],
      NOW,
    );
    const inputs: RecoInput[] = ["cat-a", "cat-b"].map((id, index) => ({
      candidate: { ...candidateOf(80 + index), catalogId: id },
      title: title(id),
    }));
    const tired = Array.from({ length: 6 }, (_, index): TonightEvent => ({
      titleId: "cat-a",
      kind: "shown",
      createdAt: new Date(NOW.getTime() - index * DAY),
    }));
    const picks = scoreRecos({ inputs, profile, titlesById: new Map(), events: tired, now: NOW });
    assert.equal(picks[0]!.catalogId, "cat-b");
  });
});
