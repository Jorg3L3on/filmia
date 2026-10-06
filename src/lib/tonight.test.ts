import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTonight, PARA_TI_SLUG } from "./tonight";
import { itemVector, cosine } from "./tonight/features";
import { findPinnedTitleId } from "./tonight/pin";
import { rankForNow } from "./tonight/serve";
import {
  bedtimeFor,
  fitForRuntime,
  isWeekendNight,
  parseNightEnds,
  remainingMinutes,
} from "./tonight/time";
import { bayesianQuality, fatigueMultiplier } from "./tonight/score";
import { mmrSelect } from "./tonight/select";
import type { TonightEvent, TonightQueueEntry, TonightTitle } from "./tonight/types";

const NOW = new Date(2026, 9, 4, 20, 30, 0); // Sunday 4 Oct 2026, 20:30 local
const DAY = 24 * 60 * 60 * 1000;

const genre = (id: number, name: string) => ({ id, name });
const SCIFI = genre(878, "Ciencia ficción");
const DRAMA = genre(18, "Drama");
const COMEDY = genre(35, "Comedia");
const ACTION = genre(28, "Acción");

const title = (
  id: string,
  overrides: Partial<TonightTitle> = {},
): TonightTitle => ({
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
  tags: [],
  listSlugs: [],
  availableSince: null,
  createdAt: new Date(NOW.getTime() - 200 * DAY),
  ...overrides,
});

const queued = (titleId: string, position: number, daysAgo = 60, queueNote: string | null = null): TonightQueueEntry => ({
  titleId,
  position,
  addedAt: new Date(NOW.getTime() - daysAgo * DAY),
  queueNote,
});

const NIGHT = { weekday: "23:30", weekend: "01:00" };

describe("tonight/time", () => {
  it("parses night ends with defaults", () => {
    assert.deepEqual(parseNightEnds(null), { weekday: "23:30", weekend: "01:00" });
    assert.deepEqual(parseNightEnds({ weekday: "22:00", weekend: "nope" }), {
      weekday: "22:00",
      weekend: "01:00",
    });
  });

  it("treats Friday and Saturday (and their small hours) as weekend nights", () => {
    assert.equal(isWeekendNight(new Date(2026, 9, 2, 22, 0)), true); // Friday
    assert.equal(isWeekendNight(new Date(2026, 9, 3, 1, 30)), true); // Saturday 01:30 = Friday night
    assert.equal(isWeekendNight(NOW), false); // Sunday evening
    assert.equal(isWeekendNight(new Date(2026, 9, 5, 0, 30)), false); // Monday 00:30 = Sunday night
  });

  it("rolls bedtimes before 06:00 to the next civil day", () => {
    const friday = new Date(2026, 9, 2, 22, 0);
    const bedtime = bedtimeFor(friday, NIGHT);
    assert.equal(bedtime.getDate(), 3);
    assert.equal(bedtime.getHours(), 1);
    assert.equal(remainingMinutes(friday, NIGHT), 180);
    assert.equal(remainingMinutes(NOW, NIGHT), 180);
  });

  it("fits runtimes inside the remaining night", () => {
    const ok = fitForRuntime(169, 180, NOW);
    assert.equal(ok.fit, 1);
    assert.equal(ok.endsAt, "23:19");
    const over = fitForRuntime(200, 180, NOW);
    assert.equal(over.overflowMinutes, 20);
    assert.ok(over.fit > 0.5 && over.fit < 0.6);
    assert.equal(fitForRuntime(240, 180, NOW).fit, 0);
    assert.equal(fitForRuntime(null, 180, NOW).fit, 0.6);
  });
});

describe("tonight/score", () => {
  it("shrinks IMDb toward the prior with few votes", () => {
    const many = bayesianQuality(8.7, 2_000_000, 6.9) ?? 0;
    const few = bayesianQuality(8.7, 500, 6.9) ?? 0;
    assert.ok(many > 8.6);
    assert.ok(few < 7.3 && few > 6.9);
  });

  it("fatigues titles shown night after night, never below the floor", () => {
    const events: TonightEvent[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((days) => ({
      titleId: "a",
      kind: "shown",
      createdAt: new Date(NOW.getTime() - days * DAY),
    }));
    assert.equal(fatigueMultiplier([], NOW), 1);
    assert.ok(fatigueMultiplier(events.slice(0, 2), NOW) < 0.73);
    assert.equal(fatigueMultiplier(events, NOW), 0.4);
  });
});

describe("tonight/features", () => {
  it("builds comparable vectors", () => {
    const a = itemVector(title("a", { genres: [SCIFI, DRAMA], keywords: [{ id: 1, name: "space" }] }));
    const b = itemVector(title("b", { genres: [SCIFI], keywords: [{ id: 1, name: "space" }] }));
    const c = itemVector(title("c", { genres: [COMEDY], year: 1990, originalLanguage: "fr" }));
    assert.ok(cosine(a, b) > 0.6);
    assert.ok(cosine(a, c) < 0.2);
  });
});

describe("computeTonight", () => {
  const dune = title("dune", {
    name: "Dune: Parte dos",
    genres: [SCIFI, DRAMA],
    keywords: [{ id: 1, name: "espacio" }, { id: 2, name: "desierto" }],
    people: [{ id: 525, name: "Denis Villeneuve", role: "director" }],
    watchedAt: new Date(NOW.getTime() - 30 * DAY),
    rating: 10,
  });
  const madmax = title("madmax", {
    name: "Mad Max",
    genres: [ACTION],
    keywords: [{ id: 3, name: "persecución" }],
    watchedAt: new Date(NOW.getTime() - 90 * DAY),
    rating: 6,
  });
  const romcom = title("romcom", {
    name: "Comedia romántica",
    genres: [COMEDY],
    watchedAt: new Date(NOW.getTime() - 10 * DAY),
    rating: 3,
  });
  const interstellar = title("interstellar", {
    name: "Interstellar",
    genres: [SCIFI, DRAMA],
    keywords: [{ id: 1, name: "espacio" }],
    runtimeMinutes: 169,
    imdbRating: 8.7,
    imdbVotes: 2_000_000,
  });
  const budapest = title("budapest", {
    name: "The Grand Budapest Hotel",
    genres: [COMEDY, DRAMA],
    runtimeMinutes: 100,
    imdbRating: 8.1,
    imdbVotes: 900_000,
  });
  const wick = title("wick", {
    name: "John Wick",
    genres: [ACTION],
    keywords: [{ id: 3, name: "persecución" }],
    runtimeMinutes: 101,
    imdbRating: 7.4,
    imdbVotes: 700_000,
  });
  const offPlatform = title("off", { genres: [SCIFI], availableOnMine: false, imdbRating: 9 });
  const watched = title("seen", { genres: [SCIFI], watchedAt: new Date(NOW.getTime() - DAY) });
  const notTonight = title("later", { genres: [SCIFI], imdbRating: 9.2, imdbVotes: 1_000_000 });

  const titles = [dune, madmax, romcom, interstellar, budapest, wick, offPlatform, watched, notTonight];
  const queue = [
    queued("interstellar", 2, 120, "para una noche larga"),
    queued("budapest", 0, 20),
    queued("wick", 5, 400),
    queued("off", 1),
    queued("seen", 3),
    queued("later", 4),
  ];
  const events: TonightEvent[] = [
    { titleId: "later", kind: "not_tonight", createdAt: new Date(NOW.getTime() - 2 * DAY) },
  ];

  const result = computeTonight({ titles, queue, events, userPlatforms: ["NETFLIX"], nightEnds: NIGHT, now: NOW });
  const paraTi = result.lenses.find((lens) => lens.slug === PARA_TI_SLUG);
  const all = result.lenses.flatMap((lens) => lens.picks.map((pick) => pick.titleId));

  it("keeps only queued, unwatched, available titles without a recent «Ahora no»", () => {
    assert.ok(paraTi, "Para ti lens exists");
    assert.ok(!all.includes("off"), "not on my platforms");
    assert.ok(!all.includes("seen"), "already watched");
    assert.ok(!all.includes("later"), "Ahora no in the last 14 days");
    assert.ok(!all.includes("dune"), "watched titles never become picks");
    assert.equal(new Set(all).size, all.length, "a title lives in one lens only");
  });

  it("puts the title closest to a 5★ anchor first and explains it", () => {
    const first = paraTi?.picks[0];
    assert.equal(first?.titleId, "interstellar");
    assert.ok(first?.reasons.some((reason) => reason.text === "Porque le diste 5★ a Dune: Parte dos"));
    assert.ok(first?.reasons.some((reason) => reason.kind === "note" && reason.text.includes("noche larga")));
    assert.ok((first?.components.gusto ?? 0) > (paraTi?.picks.find((pick) => pick.titleId === "wick")?.components.gusto ?? 1));
  });

  it("gives the manual #1 a position reason and the old one an aging reason", () => {
    const b = paraTi?.picks.find((pick) => pick.titleId === "budapest");
    assert.ok(b?.reasons.some((reason) => reason.kind === "position" && reason.text.includes("primera")));
    const w = paraTi?.picks.find((pick) => pick.titleId === "wick");
    assert.ok(w?.reasons.some((reason) => reason.kind === "aging" && reason.text.includes("más de un año")));
  });

  it("re-ranks for the clock: a long film past bedtime drops below a short one", () => {
    const cards = (paraTi?.picks ?? []).map((pick) => ({
      id: pick.titleId,
      runtimeMinutes: titles.find((item) => item.id === pick.titleId)?.runtimeMinutes ?? null,
      components: pick.components,
      reasons: pick.reasons,
      wildcard: pick.wildcard,
    }));
    const early = rankForNow(cards, { now: NOW, nightEnds: NIGHT, keepWildcardLast: true });
    assert.equal(early[0]?.id, "interstellar");
    assert.equal(early[0]?.fit.endsAt, "23:19");
    const late = rankForNow(cards, { now: new Date(2026, 9, 4, 22, 0), nightEnds: NIGHT, keepWildcardLast: true });
    const interstellarLate = late.find((card) => card.id === "interstellar");
    assert.ok(interstellarLate && interstellarLate.fit.overflowMinutes > 0);
    assert.ok(late[0]?.id !== "interstellar", "a film that overflows bedtime is no longer the hero");
    assert.ok(interstellarLate?.headline.some((reason) => reason.kind === "fit_over"));
  });

  it("keeps a pinned card first even when the clock would bury it", () => {
    const cards = (paraTi?.picks ?? []).map((pick) => ({
      id: pick.titleId,
      runtimeMinutes: titles.find((item) => item.id === pick.titleId)?.runtimeMinutes ?? null,
      components: pick.components,
      reasons: pick.reasons,
      wildcard: pick.wildcard,
      pinned: pick.titleId === "interstellar",
    }));
    const late = rankForNow(cards, {
      now: new Date(2026, 9, 4, 22, 0),
      nightEnds: NIGHT,
      keepWildcardLast: true,
      keepPinnedFirst: true,
    });
    assert.equal(late[0]?.id, "interstellar");
    assert.ok(late.at(-1)?.wildcard || !late.some((card) => card.wildcard), "wildcard still last");
  });
});

describe("tonight/pin", () => {
  const event = (titleId: string, kind: TonightEvent["kind"], minutesAgo: number): TonightEvent => ({
    titleId,
    kind,
    createdAt: new Date(NOW.getTime() - minutesAgo * 60_000),
  });

  it("returns the newest pin inside the 18 h window", () => {
    assert.equal(findPinnedTitleId([event("a", "pinned", 120), event("b", "pinned", 10)], NOW), "b");
    assert.equal(findPinnedTitleId([event("a", "pinned", 19 * 60)], NOW), null);
    assert.equal(findPinnedTitleId([event("a", "shown", 5)], NOW), null);
  });

  it("is cancelled by a later «Ahora no» on the same title", () => {
    assert.equal(findPinnedTitleId([event("a", "pinned", 30), event("a", "not_tonight", 5)], NOW), null);
    assert.equal(findPinnedTitleId([event("a", "not_tonight", 30), event("a", "pinned", 5)], NOW), "a");
  });
});

describe("mmrSelect", () => {
  it("caps a primary genre at two cards while there are alternatives", () => {
    const make = (id: string, g: { id: number; name: string }, score: number) => {
      const t = title(id, { genres: [g] });
      return {
        title: t,
        vector: itemVector(t),
        pick: { titleId: id, components: { gusto: 0, calidad: 0, impulso: 0, novedad: 0, reposo: 0, fatiga: 1 }, baseScore: score, reasons: [], wildcard: false },
      };
    };
    const picked = mmrSelect(
      [make("d1", DRAMA, 0.9), make("d2", DRAMA, 0.88), make("d3", DRAMA, 0.87), make("c1", COMEDY, 0.5), make("a1", ACTION, 0.4)],
      4,
    );
    const ids = picked.map((item) => item.title.id);
    assert.equal(ids.filter((id) => id.startsWith("d")).length, 2);
    assert.ok(ids.includes("c1") && ids.includes("a1"));
  });
});
