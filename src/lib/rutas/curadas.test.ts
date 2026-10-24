import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogRow } from "@/db";
import { endOfMxDay, isExpired, parseSourceKey } from "./core";
import { bestCuratedDraft, curatedFit, curatedRutaDraft, isCuratedOpen, type CuratedList } from "./curadas";

const film = (tmdbId: number, name: string, genres: number[], people: Array<[number, string, string]> = []) =>
  ({
    id: `c${tmdbId}`,
    tmdbId,
    kind: "MOVIE",
    name,
    originalName: null,
    year: 2000 + (tmdbId % 20),
    posterPath: null,
    backdropPath: null,
    overview: null,
    imdbRating: 7.5,
    imdbVotes: 1000,
    tmdbGenres: genres.map((id) => ({ id, name: `g${id}` })),
    tmdbPeople: people.map(([id, personName, role]) => ({ id, name: personName, role })),
  }) as unknown as CatalogRow;

const biopics: CuratedList = {
  id: "listbiopics0001",
  name: "Después de Michael: biopics con música",
  description: null,
  curatedFrom: null,
  curatedUntil: null,
  curatedFor: [936075],
  items: [
    { film: film(1, "Bohemian Rhapsody", [18, 10402]), note: "La más parecida." },
    { film: film(2, "Rocketman", [18, 10402]), note: null },
    { film: film(3, "Elvis", [18, 10402]), note: "Luhrmann a todo volumen." },
  ],
};

const seed = (tmdbId: number, name: string, genreIds: number[], watched = true) => ({
  tmdbId,
  name,
  watched,
  genreIds,
  people: [],
});

describe("rutas curadas", () => {
  it("fits who saw the film it follows best, then by genres", () => {
    assert.ok(curatedFit(biopics, [seed(936075, "Michael", [18, 10402, 36])]) >= 10);
    assert.equal(curatedFit(biopics, [seed(120, "LOTR", [12, 14])]), 0);
    assert.equal(curatedFit(biopics, [seed(936075, "Michael", [18, 10402], false)]), 0, "Quiero ver does not count");
  });

  it("is the list in its order; the notes are the whys", () => {
    const draft = curatedRutaDraft(biopics, new Set([2]), { tmdbId: 936075, name: "Michael" });
    assert.ok(draft);
    assert.equal(draft.kind, "curada");
    assert.equal(draft.sourceKey, "curada:listbiopics0001");
    assert.deepEqual(draft.steps.map((step) => step.why), ["La más parecida.", "Ya la viste: cuenta", "Luhrmann a todo volumen."]);
    assert.equal(draft.reason, "Después de Michael, escrita a mano.");
    assert.deepEqual(parseSourceKey(draft.sourceKey), { kind: "curada", listId: "listbiopics0001" });
  });

  it("de temporada: offered inside its window, ends with it", () => {
    const octubre = { ...biopics, id: "listoctubre0001", curatedFrom: "2026-10-01", curatedUntil: "2026-10-31" };
    assert.equal(isCuratedOpen(octubre, "2026-10-23"), true);
    assert.equal(isCuratedOpen(octubre, "2026-11-01"), false);
    assert.equal(isCuratedOpen(octubre, "2026-09-30"), false);
    const draft = curatedRutaDraft(octubre, new Set(), null);
    assert.equal(draft?.kind, "temporada");
    assert.equal(draft?.endsOn, "2026-10-31");
    // The ruta is archived past the end of that day in Mexico City, not before.
    const endsAt = endOfMxDay("2026-10-31");
    assert.equal(isExpired(endsAt, new Date("2026-11-01T05:59:00Z")), false);
    assert.equal(isExpired(endsAt, new Date("2026-11-01T06:01:00Z")), true);
  });

  it("the best fitting one, never one you already have", () => {
    const seeds = [seed(936075, "Michael", [18, 10402])];
    assert.equal(bestCuratedDraft([biopics], seeds, new Set(), new Set())?.title, biopics.name);
    assert.equal(bestCuratedDraft([biopics], seeds, new Set(), new Set(["curada:listbiopics0001"])), null);
  });

  it("seasonal source keys parse", () => {
    assert.deepEqual(parseSourceKey(`temporada:${"a".repeat(32)}:137427:director`), {
      kind: "temporada",
      catalogId: "a".repeat(32),
      personIds: [137427],
      role: "director",
    });
  });
});
