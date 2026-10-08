import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TonightQueueEntry, TonightReason, TonightTitle } from "@/lib/tonight/types";
import { creditParts, formatCredits, isLatinName, reasonPerson } from "@/lib/watchlist-credits";
import { chooseHook, fallbackReasons, fitHook } from "@/lib/watchlist-hook";

const NOW = new Date(2026, 9, 5, 21, 40, 0);
const DAY = 24 * 60 * 60 * 1000;

const title = (overrides: Partial<TonightTitle> = {}): TonightTitle => ({
  id: "t",
  name: "Blade Runner",
  kind: "MOVIE",
  year: 1982,
  runtimeMinutes: 117,
  imdbRating: 8.1,
  imdbVotes: null,
  genres: [],
  keywords: [],
  people: [
    { id: 1, name: "Ridley Scott", role: "director" },
    { id: 2, name: "Harrison Ford", role: "cast" },
    { id: 3, name: "Rutger Hauer", role: "cast" },
    { id: 4, name: "Sean Young", role: "cast" },
    { id: 5, name: "Edward James Olmos", role: "cast" },
  ],
  originalLanguage: "en",
  platform: null,
  flatrate: [{ providerId: 9, name: "Amazon Prime Video", logoPath: null, logoUrl: null }],
  availableOnMine: true,
  watchedAt: null,
  rating: null,
  review: null,
  seriesStatus: null,
  seriesSeason: null,
  listSlugs: [],
  availableSince: null,
  createdAt: new Date(NOW.getTime() - 40 * DAY),
  ...overrides,
});

const entry = (overrides: Partial<TonightQueueEntry> = {}): TonightQueueEntry => ({
  titleId: "t",
  position: 5,
  addedAt: new Date(NOW.getTime() - 40 * DAY),
  queueNote: null,
  ...overrides,
});

const reason = (kind: TonightReason["kind"], text: string, weight = 0.5): TonightReason => ({
  kind,
  text,
  weight,
  personal: true,
});

const fits = { fit: 1, endsAt: "23:37", overflowMinutes: 0, remainingMinutes: 110 };

describe("watchlist-hook/chooseHook", () => {
  const base = { fit: null, queueNote: null, kind: "MOVIE" as const, runtimeMinutes: 117, snoozedUntil: null, now: NOW };

  it("follows the priority order", () => {
    const reasons = [reason("quality", "IMDb 8.1"), reason("fresh_platform", "Acaba de llegar a Max"), reason("taste_person", "Dirigida por X")];
    assert.equal(chooseHook({ ...base, reasons })?.text, "Acaba de llegar a Max");
    assert.equal(chooseHook({ ...base, reasons: reasons.slice(0, 1) })?.text, "IMDb 8.1");
    assert.equal(chooseHook({ ...base, reasons: [] }), null);
  });

  it("never surfaces position, fit_over or wildcard reasons", () => {
    const reasons = [reason("position", "La pusiste primera"), reason("wildcard", "Comodín"), reason("fit_over", "Se pasa")];
    assert.equal(chooseHook({ ...base, reasons }), null);
  });

  it("puts the clock between «acaba de llegar» and the user's note", () => {
    const reasons = [reason("taste_person", "Dirigida por X")];
    assert.equal(chooseHook({ ...base, reasons, fit: fits })?.text, "Termina a tiempo · acaba 23:37");
    assert.equal(chooseHook({ ...base, reasons, fit: fits, kind: "SERIES", runtimeMinutes: 50 })?.text, "Un capítulo termina a tiempo · acaba 23:37");
    assert.equal(chooseHook({ ...base, reasons, queueNote: "Para un domingo largo." })?.kind, "note");
    assert.equal(chooseHook({ ...base, reasons: [reason("fresh_platform", "Acaba de llegar a MUBI")], fit: fits })?.kind, "fresh_platform");
  });

  it("drops the fit line when the film overflows, the night is over or far away", () => {
    assert.equal(fitHook({ ...fits, overflowMinutes: 12 }, "MOVIE", 117), null);
    assert.equal(fitHook({ ...fits, remainingMinutes: 0 }, "MOVIE", 117), null);
    assert.equal(fitHook({ ...fits, remainingMinutes: 600 }, "MOVIE", 117), null);
    assert.equal(fitHook(fits, "MOVIE", null), null);
  });

  it("a live snooze beats everything", () => {
    const hook = chooseHook({ ...base, reasons: [reason("fresh_platform", "x")], snoozedUntil: new Date(2026, 9, 19) });
    assert.equal(hook?.kind, "snoozed");
    assert.match(hook?.text ?? "", /^Ahora no · vuelve a Hoy el 19 oct/);
    assert.equal(chooseHook({ ...base, reasons: [reason("fresh_platform", "x")], snoozedUntil: new Date(2026, 8, 1) })?.kind, "fresh_platform");
  });
});

describe("watchlist-hook/fallbackReasons", () => {
  it("builds freshness, quality and director lines for an unranked title", () => {
    const reasons = fallbackReasons(
      title({ availableSince: new Date(NOW.getTime() - 2 * DAY) }),
      entry(),
      NOW,
      { qualityBar: 8 },
    );
    assert.ok(reasons.some((r) => r.kind === "fresh_platform" && r.text.startsWith("Acaba de llegar a ")));
    assert.ok(reasons.some((r) => r.kind === "quality" && r.text === "IMDb 8.1 · entre lo mejor de tu lista"));
    assert.ok(reasons.some((r) => r.kind === "taste_person" && r.text === "Dirigida por Ridley Scott"));
  });

  it("skips quality below 7.8 and unreadable director names", () => {
    const reasons = fallbackReasons(
      title({ imdbRating: 7.1, people: [{ id: 9, name: "黒澤明", role: "director" }] }),
      entry(),
      NOW,
    );
    assert.ok(!reasons.some((r) => r.kind === "quality"));
    assert.ok(!reasons.some((r) => r.kind === "taste_person"));
  });
});

describe("watchlist-credits", () => {
  it("formats director and three cast names, dropping native-script ones", () => {
    assert.equal(
      formatCredits(title().people, "MOVIE"),
      "Dirigida por Ridley Scott · Con Harrison Ford, Rutger Hauer y Sean Young",
    );
    assert.equal(
      formatCredits(
        [
          { id: 1, name: "Akira Kurosawa", role: "director" },
          { id: 2, name: "三船敏郎", role: "cast" },
          { id: 3, name: "京マチ子", role: "cast" },
        ],
        "MOVIE",
      ),
      "Dirigida por Akira Kurosawa",
    );
    assert.equal(formatCredits([{ id: 1, name: "Dan Erickson", role: "creator" }], "SERIES"), "Creada por Dan Erickson");
    assert.equal(formatCredits([{ id: 1, name: "Виктор Косаковский", role: "director" }], "MOVIE"), null);
    assert.equal(isLatinName("Céline Sciamma"), true);
    assert.equal(isLatinName("손예진"), false);
  });

  it("names every director (or a series' creators) with their TMDB ids for the links", () => {
    const coens = [
      { id: 1223, name: "Joel Coen", role: "director" as const },
      { id: 1224, name: "Ethan Coen", role: "director" as const },
      { id: 1223, name: "Joel Coen", role: "director" as const },
      { id: 9, name: "Frances McDormand", role: "cast" as const },
    ];
    assert.deepEqual(creditParts(coens, "MOVIE"), {
      verb: "Dirigida",
      leads: [
        { id: 1223, name: "Joel Coen" },
        { id: 1224, name: "Ethan Coen" },
      ],
      cast: ["Frances McDormand"],
    });
    assert.equal(formatCredits(coens, "MOVIE"), "Dirigida por Joel Coen y Ethan Coen · Con Frances McDormand");
    const series = [
      { id: 5, name: "Some Episode Director", role: "director" as const },
      { id: 6, name: "Dan Erickson", role: "creator" as const },
    ];
    assert.deepEqual(creditParts(series, "SERIES")?.leads, [{ id: 6, name: "Dan Erickson" }]);
    assert.equal(creditParts(series, "SERIES")?.verb, "Creada");
  });

  it("resolves Hoy's «Dirigida por» person from the reason's id, not its text", () => {
    const scorsese = { id: 1032, name: "Martin Scorsese", role: "director" as const };
    const schoonmaker = { id: 1033, name: "Someone Else", role: "director" as const };
    const reason = (personId?: number) => ({ kind: "taste_person" as const, personId });
    assert.deepEqual(reasonPerson(reason(1032), [schoonmaker, scorsese]), scorsese);
    assert.equal(reasonPerson(reason(999), [scorsese]), null, "an id the card does not have is no link");
    assert.deepEqual(reasonPerson(reason(), [scorsese]), scorsese, "old cached reason: the only lead");
    assert.equal(reasonPerson(reason(), [scorsese, schoonmaker]), null, "old cached reason, two leads: no guess");
    assert.equal(reasonPerson({ kind: "quality" }, [scorsese]), null);
    assert.equal(reasonPerson(null, [scorsese]), null);
  });
});
