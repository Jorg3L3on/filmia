import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { affinityScore, buildAffinityScorer, filmAsTitle } from "./tonight/affinity";
import { GROUP_MIN_SCORED, mixListed, rankForGroup, type GroupCandidate, type GroupMember } from "./tonight/group";
import type { TonightTitle } from "./tonight/types";

const NOW = new Date(2026, 9, 19, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const genre = (id: number, name: string) => ({ id, name });
const SCIFI = genre(878, "Ciencia ficción");
const DRAMA = genre(18, "Drama");
const COMEDY = genre(35, "Comedia");
const HORROR = genre(27, "Terror");
const kw = (id: number) => ({ id, name: `kw${id}` });
const director = (id: number, name = `Dir ${id}`) => ({ id, name, role: "director" as const });

const watched = (id: string, rating: number, overrides: Partial<TonightTitle> = {}): TonightTitle => ({
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
  watchedAt: new Date(NOW.getTime() - 300 * DAY),
  rating,
  review: null,
  seriesStatus: null,
  seriesSeason: null,
  listSlugs: [],
  availableSince: null,
  createdAt: new Date(NOW.getTime() - 400 * DAY),
  ...overrides,
});

const scifi = (prefix: string, rating: number, n = 10) =>
  Array.from({ length: n }, (_, i) =>
    watched(`${prefix}-scifi${i}`, rating, {
      name: i === 0 ? "Arrival" : `${prefix}-scifi${i}`,
      genres: [SCIFI, DRAMA],
      keywords: [kw(1), kw(2), kw(10 + i)],
      people: [director(i % 2 === 0 ? 1 : 100 + i, "Denis Villeneuve")],
    }),
  );
const comedies = (prefix: string, rating: number, n = 8) =>
  Array.from({ length: n }, (_, i) =>
    watched(`${prefix}-comedy${i}`, rating, {
      genres: [COMEDY],
      keywords: [kw(4), kw(40 + i)],
      people: [director(300 + i)],
    }),
  );
const horror = (prefix: string, rating: number, n = 6) =>
  Array.from({ length: n }, (_, i) =>
    watched(`${prefix}-horror${i}`, rating, {
      genres: [HORROR],
      keywords: [kw(5), kw(50 + i)],
      people: [director(400 + i)],
    }),
  );

/** Sci-fi lover who can't stand comedies. */
const ANA = [...scifi("a", 9), ...comedies("a", 3)];
/** Sci-fi and comedy lover who can't stand horror. */
const JORGE = [...scifi("j", 9), ...comedies("j", 9), ...horror("j", 2)];

const member = (
  id: string,
  library: TonightTitle[] | null,
  overrides: Partial<GroupMember> = {},
): GroupMember => ({
  id,
  name: id,
  scorer: library ? buildAffinityScorer(library, [], NOW) : null,
  watched: new Set(),
  platforms: ["NETFLIX"],
  ...overrides,
});

const candidate = (
  catalogId: string,
  overrides: Partial<TonightTitle> = {},
  extra: Partial<GroupCandidate> = {},
): GroupCandidate => ({
  catalogId,
  title: filmAsTitle({
    id: catalogId,
    name: catalogId,
    kind: "MOVIE",
    year: 2018,
    imdbRating: 7.6,
    imdbVotes: 300_000,
    genres: [DRAMA],
    keywords: [],
    people: [],
    originalLanguage: "en",
    ...overrides,
  }),
  inList: false,
  platforms: ["NETFLIX"],
  ...extra,
});

const SCIFI_FILM = { genres: [SCIFI, DRAMA], keywords: [kw(1), kw(2)], people: [director(1, "Denis Villeneuve")] };
const COMEDY_FILM = { genres: [COMEDY], keywords: [kw(4)] };
const HORROR_FILM = { genres: [HORROR], keywords: [kw(5)] };

describe("tonight/group · Qué vemos juntos", () => {
  it("the fixtures mean what they say", () => {
    const ana = buildAffinityScorer(ANA, [], NOW)!;
    const jorge = buildAffinityScorer(JORGE, [], NOW)!;
    const comedy = candidate("c", COMEDY_FILM).title;
    assert.equal(affinityScore(ana, comedy).level, "baja");
    assert.notEqual(affinityScore(jorge, comedy).level, "baja");
  });

  it("misery veto: one loves it, the other hates it → out", () => {
    const result = rankForGroup(
      [member("Ana", ANA), member("Jorge", JORGE)],
      [candidate("comedy", COMEDY_FILM), candidate("scifi", SCIFI_FILM)],
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.deepEqual(result.picks.map((pick) => pick.catalogId), ["scifi"]);
    assert.equal(result.relaxed, false);
  });

  it("no pick has «baja» for anyone unless relaxed, and relaxed allows one veto at most", () => {
    const members = [member("Ana", ANA), member("Jorge", JORGE)];
    const result = rankForGroup(members, [
      candidate("comedy", COMEDY_FILM),
      candidate("horror", HORROR_FILM),
      candidate("scifi", SCIFI_FILM),
    ]);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    for (const pick of result.picks) {
      assert.equal(pick.vetoedBy.length, 0);
      for (const m of members) {
        assert.notEqual(affinityScore(m.scorer!, candidate(pick.catalogId, SCIFI_FILM).title).level, "baja");
      }
    }

    const onlyBad = rankForGroup(members, [candidate("comedy", COMEDY_FILM)]);
    assert.equal(onlyBad.status, "ok");
    if (onlyBad.status !== "ok") return;
    assert.equal(onlyBad.relaxed, true);
    assert.ok(onlyBad.picks.every((pick) => pick.vetoedBy.length <= 1));
    assert.deepEqual(onlyBad.picks[0].vetoedBy, ["Ana"]);
  });

  it("nothing someone watching already saw", () => {
    const result = rankForGroup(
      [member("Ana", ANA, { watched: new Set(["scifi"]) }), member("Jorge", JORGE)],
      [candidate("scifi", SCIFI_FILM), candidate("scifi2", SCIFI_FILM)],
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.deepEqual(result.picks.map((pick) => pick.catalogId), ["scifi2"]);
  });

  it("a member in cold start is flagged and the rest decide", () => {
    const result = rankForGroup(
      [member("Ana", ANA), member("Jorge", JORGE), member("Leo", ANA.slice(0, 5))],
      [candidate("scifi", SCIFI_FILM)],
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.deepEqual(result.cold, ["Leo"]);
    assert.equal(result.picks.length, 1);
  });

  it(`fewer than ${GROUP_MIN_SCORED} members with a profile → few_ratings`, () => {
    const result = rankForGroup([member("Ana", ANA), member("Leo", null)], [candidate("scifi", SCIFI_FILM)]);
    assert.deepEqual(result, { status: "few_ratings", cold: ["Leo"] });
  });

  it("new suggestions only on someone's platform; list items stay, flagged and last", () => {
    const result = rankForGroup(
      [member("Ana", ANA, { platforms: ["NETFLIX"] }), member("Jorge", JORGE, { platforms: ["MAX"] })],
      [
        candidate("on-max", SCIFI_FILM, { platforms: ["MAX"] }),
        candidate("on-disney", SCIFI_FILM, { platforms: ["DISNEY"] }),
        candidate("listed-disney", SCIFI_FILM, { platforms: ["DISNEY"], inList: true }),
      ],
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.deepEqual(result.picks.map((pick) => pick.catalogId), ["on-max", "listed-disney"]);
    assert.deepEqual(result.picks[0].platforms, ["MAX"]);
    assert.equal(result.picks[1].offPlatforms, true);
  });

  it("nothing on their platforms → no_platform", () => {
    const result = rankForGroup(
      [member("Ana", ANA), member("Jorge", JORGE)],
      [candidate("on-disney", SCIFI_FILM, { platforms: ["DISNEY"] })],
    );
    assert.equal(result.status, "no_platform");
  });

  it("reasons name people and films, never a rating", () => {
    const result = rankForGroup([member("Ana", ANA), member("Jorge", JORGE)], [candidate("scifi", SCIFI_FILM)]);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    const texts = result.picks[0].reasons.map((reason) => reason.text);
    assert.ok(texts.length > 0);
    assert.ok(texts.some((text) => text.startsWith("A los 2")), texts.join(" | "));
    for (const text of texts) {
      assert.doesNotMatch(text, /★|\/10|\d(\.\d)? estrellas|le diste/);
    }
  });

  it("talks to the person looking: «a ti», «te»", () => {
    const result = rankForGroup(
      [member("Ana", ANA, { self: true }), member("Jorge", JORGE), member("Leo", JORGE)],
      [candidate("comedy-ok", { genres: [COMEDY, SCIFI], keywords: [kw(1), kw(4)] }), candidate("scifi", SCIFI_FILM)],
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    const texts = result.picks.flatMap((pick) => pick.reasons.map((reason) => reason.text));
    assert.ok(!texts.some((text) => /\bA Ana\b|a Ana le/.test(text)), texts.join(" | "));
    for (const text of texts.filter((t) => /\bti\b/.test(t))) {
      assert.match(text, /^A ti te |^A ti y a |: a ti te /);
    }
  });

  it("ordered by the mean, ties by the least happy person", () => {
    const result = rankForGroup(
      [member("Ana", ANA), member("Jorge", JORGE)],
      [
        candidate("scifi-a", { ...SCIFI_FILM, keywords: [kw(1)] }),
        candidate("scifi-b", SCIFI_FILM),
        candidate("scifi-c", { ...SCIFI_FILM, people: [] }),
        candidate("scifi-d", { ...SCIFI_FILM, keywords: [kw(1)] }),
      ],
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.ok(result.picks.length >= 2);
    for (let i = 1; i < result.picks.length; i += 1) {
      const [a, b] = [result.picks[i - 1], result.picks[i]];
      assert.ok(a.score > b.score || (a.score === b.score && a.min >= b.min));
    }
  });

  it("keeps two «En la lista» in the top five when the list has them", () => {
    const pick = (id: string, inList: boolean) => ({ id, inList, offPlatforms: false });
    const sorted = [
      pick("n1", false),
      pick("n2", false),
      pick("n3", false),
      pick("n4", false),
      pick("l1", true),
      pick("n5", false),
      pick("l2", true),
      pick("l3", true),
    ];
    assert.deepEqual(
      mixListed(sorted).map((p) => p.id),
      ["n1", "n2", "n3", "l1", "l2", "n4", "n5", "l3"],
    );
    const already = [pick("l1", true), pick("l2", true), pick("n1", false)];
    assert.deepEqual(mixListed(already), already);
    const none = [pick("n1", false), pick("n2", false)];
    assert.deepEqual(mixListed(none), none);
  });

  it("4 members × 400 candidates in under 150 ms", () => {
    const members = [member("A", ANA), member("B", JORGE), member("C", ANA), member("D", JORGE)];
    const candidates = Array.from({ length: 400 }, (_, i) =>
      candidate(`f${i}`, {
        genres: i % 3 === 0 ? [COMEDY] : [SCIFI, DRAMA],
        keywords: [kw(1 + (i % 5)), kw(60 + i)],
        people: [director(i % 7 === 0 ? 1 : 500 + i)],
      }),
    );
    rankForGroup(members, candidates);
    const started = performance.now();
    rankForGroup(members, candidates);
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 150, `${elapsed.toFixed(1)} ms`);
  });
});
