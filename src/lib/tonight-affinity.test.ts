import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AFFINITY_MIN_RATED,
  AFFINITY_PROFILE_OPTIONS,
  affinityFor,
  buildAffinityContext,
  buildAffinityScorer,
  featureCoverage,
  filmAsTitle,
  isLiked,
  levelFor,
  likedTasteLeaveOneOut,
  quantile,
} from "./tonight/affinity";
import { cosine, itemVector } from "./tonight/features";
import { buildTasteProfile, recencyWeight } from "./tonight/profile";
import type { TonightTitle } from "./tonight/types";

const NOW = new Date(2026, 9, 12, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const genre = (id: number, name: string) => ({ id, name });
const SCIFI = genre(878, "Ciencia ficción");
const DRAMA = genre(18, "Drama");
const COMEDY = genre(35, "Comedia");
const HORROR = genre(27, "Terror");
const ANIMATION = genre(16, "Animación");
const kw = (id: number) => ({ id, name: `kw${id}` });
const director = (id: number, name = `Dir ${id}`) => ({ id, name, role: "director" as const });

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
  createdAt: new Date(NOW.getTime() - 400 * DAY),
  ...overrides,
});

const watched = (id: string, rating: number | null, overrides: Partial<TonightTitle> = {}) =>
  title(id, { watchedAt: new Date(NOW.getTime() - 300 * DAY), rating, ...overrides });

/** A sci-fi lover by Villeneuve-like director 1 who dislikes comedies. */
const library = (): TonightTitle[] => [
  ...Array.from({ length: 12 }, (_, i) =>
    watched(`scifi${i}`, 9, {
      genres: [SCIFI, DRAMA],
      keywords: [kw(1), kw(2), kw(10 + i)],
      people: [director(i % 3 === 0 ? 1 : 100 + i)],
      year: 2010 + (i % 10),
    }),
  ),
  ...Array.from({ length: 6 }, (_, i) =>
    watched(`drama${i}`, 8, { genres: [DRAMA], keywords: [kw(3), kw(30 + i)], people: [director(200 + i)] }),
  ),
  ...Array.from({ length: 5 }, (_, i) =>
    watched(`comedy${i}`, 4, { genres: [COMEDY], keywords: [kw(4), kw(40 + i)], people: [director(300 + i)] }),
  ),
];

const film = (id: string, overrides: Partial<TonightTitle> = {}) =>
  filmAsTitle({
    id,
    name: id,
    kind: "MOVIE",
    year: 2016,
    imdbRating: 7.4,
    imdbVotes: 300_000,
    genres: [DRAMA],
    keywords: [],
    people: [],
    originalLanguage: "en",
    ...overrides,
  });

describe("tonight/affinity", () => {
  it("«me gustó» is ≥7 or Favoritas", () => {
    assert.equal(isLiked({ rating: 7, listSlugs: [] }), true);
    assert.equal(isLiked({ rating: 6, listSlugs: [] }), false);
    assert.equal(isLiked({ rating: null, listSlugs: ["favoritas"] }), true);
    assert.equal(isLiked({ rating: null, listSlugs: [] }), false);
  });

  it("cold start: fewer than 8 rated watches → no scorer", () => {
    const thin = library().slice(0, AFFINITY_MIN_RATED - 1);
    assert.equal(buildAffinityScorer(thin, [], NOW), null);
    assert.ok(buildAffinityScorer(library(), [], NOW));
  });

  it("more overlap with what you liked → a higher or equal level", () => {
    const scorer = buildAffinityScorer(library(), [], NOW)!;
    const rank = { baja: 0, media: 1, alta: 2 } as const;
    const close = film("close", {
      genres: [SCIFI, DRAMA],
      keywords: [kw(1), kw(2)],
      people: [director(1, "Denis")],
    });
    const middle = film("middle", { genres: [DRAMA], keywords: [kw(3)] });
    const far = film("far", { genres: [COMEDY], keywords: [kw(4)] });
    const levels = [close, middle, far].map((f) => affinityFor(scorer, f).level);
    assert.equal(levels[0], "alta");
    assert.ok(rank[levels[0]] >= rank[levels[1]]);
    assert.ok(rank[levels[1]] >= rank[levels[2]]);
    assert.equal(levels[2], "baja");
  });

  it("explains a close film with the anchor, the director and its genres, at most three", () => {
    const scorer = buildAffinityScorer(library(), [], NOW)!;
    const affinity = affinityFor(
      scorer,
      film("close", { genres: [SCIFI, DRAMA], keywords: [kw(1), kw(2)], people: [director(1, "Denis")] }),
    );
    assert.ok(affinity.reasons.length <= 3);
    const kinds = affinity.reasons.map((reason) => reason.kind);
    assert.ok(kinds.includes("taste_anchor"));
    assert.ok(affinity.reasons.some((reason) => reason.text === "Dirigida por Denis"));
    assert.ok(affinity.reasons[0].text.startsWith("Porque le diste 4.5★ a"));
    assert.equal(affinity.label, "Muy tu estilo");
  });

  it("a genre you barely watch says so", () => {
    const scorer = buildAffinityScorer(library(), [], NOW)!;
    const affinity = affinityFor(scorer, film("anime", { genres: [ANIMATION, HORROR], originalLanguage: "ja" }));
    assert.notEqual(affinity.level, "alta");
    assert.ok(affinity.reasons.some((reason) => reason.text === "Casi no ves animación y terror"));
  });

  it("confidence falls with unseen features and shrinks the level toward the middle", () => {
    const scorer = buildAffinityScorer(library(), [], NOW)!;
    const known = affinityFor(scorer, film("known", { genres: [SCIFI, DRAMA], keywords: [kw(1), kw(2)] }));
    const unknown = film("unknown", {
      genres: [SCIFI],
      keywords: [kw(900), kw(901), kw(902), kw(903), kw(904), kw(905)],
      people: [director(999)],
      originalLanguage: "ko",
      year: 1975,
    });
    const affinity = affinityFor(scorer, unknown);
    assert.ok(affinity.confidence < known.confidence);
    assert.equal(affinity.lowConfidence, true);
    assert.ok(featureCoverage(scorer.ctx.profile, itemVector(unknown)) < 0.5);
  });

  it("fewer rated watches lower the confidence", () => {
    const full = buildAffinityScorer(library(), [], NOW)!;
    const all = library();
    const thinLibrary = [...all.slice(0, 6), ...all.slice(12, 14), ...all.slice(18, 20)];
    const thin = buildAffinityScorer(thinLibrary, [], NOW)!;
    const f = film("f", { genres: [SCIFI, DRAMA], keywords: [kw(1), kw(2)] });
    assert.ok(affinityFor(thin, f).confidence < affinityFor(full, f).confidence);
  });

  it("the fast leave-one-out equals rebuilding the profile without the film", () => {
    const titles = library();
    const options = AFFINITY_PROFILE_OPTIONS;
    const ctx = buildAffinityContext(titles, [], NOW, options);
    const fast = likedTasteLeaveOneOut(ctx, titles, NOW, options);
    const liked = titles.filter((t) => isLiked(t));
    liked.forEach((target, index) => {
      const rest = titles.filter((t) => t.id !== target.id);
      const profile = buildTasteProfile(rest, [], NOW, options);
      const exact = cosine(profile.vector, itemVector(target));
      // The mean moves a little without the film; the vector maths is exact otherwise.
      assert.ok(Math.abs(exact - fast[index]) < 0.05, `${target.id}: ${exact} vs ${fast[index]}`);
    });
  });

  it("levels and quantiles", () => {
    assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
    assert.equal(quantile([0, 10], 0.1), 1);
    const cutoffs = { high: 0.3, low: 0.1 };
    assert.equal(levelFor(0.3, cutoffs), "alta");
    assert.equal(levelFor(0.2, cutoffs), "media");
    assert.equal(levelFor(0.05, cutoffs), "baja");
  });

  it("collections add mild evidence only to unrated or liked watches", () => {
    const options = { halfLifeMonths: null, collectionBonus: 0.3 };
    const base = [watched("a", null, { genres: [SCIFI] }), watched("b", 2, { genres: [COMEDY] })];
    const inList = base.map((t) => ({ ...t, listSlugs: ["lista-propia"] }));
    const plain = buildTasteProfile(base, [], NOW, options);
    const listed = buildTasteProfile(inList, [], NOW, options);
    assert.ok((listed.genreAffinity.get(SCIFI.id) ?? 0) > (plain.genreAffinity.get(SCIFI.id) ?? 0));
    assert.equal(listed.genreAffinity.get(COMEDY.id), plain.genreAffinity.get(COMEDY.id));
  });

  it("Hoy keeps its defaults: 18-month recency and no collection bonus", () => {
    const old = new Date(NOW.getTime() - 18 * 30.44 * DAY);
    assert.ok(Math.abs(recencyWeight(old, NOW) - 0.5) < 0.02);
    assert.equal(recencyWeight(old, NOW, null), 1);
    const titles = library().map((t) => ({ ...t, listSlugs: ["lista-propia"] }));
    const hoy = buildTasteProfile(titles, [], NOW);
    const noLists = buildTasteProfile(library(), [], NOW);
    assert.deepEqual([...hoy.vector], [...noLists.vector]);
  });
});
