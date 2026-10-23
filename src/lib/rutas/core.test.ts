import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectionBaseName,
  collectionRutaDraft,
  collectionRutaTitle,
  duoName,
  filmNameInSaga,
  findThread,
  isDuo,
  MAX_ACTIVE_RUTAS,
  parseSourceKey,
  parseThreadPeople,
  personRoleFilms,
  personRutaDraft,
  personSourceKey,
  placeRutaLenses,
  rankSeeds,
  rutaProgress,
  stampChanges,
  statusForNewRuta,
  stepStates,
  threadLine,
  type RutaFilm,
} from "./core";
import type { TmdbCollectionPayload } from "@/lib/tmdb";
import type { TmdbCombinedCredits } from "@/lib/person-filmography";

const TODAY = "2026-10-23";

/** TMDB collection 119 as es-MX returns it (trimmed). */
const LOTR: TmdbCollectionPayload = {
  id: 119,
  name: "El Señor de los Anillos - Colección",
  parts: [
    { id: 122, title: "El señor de los anillos: El retorno del rey", release_date: "2003-12-17", vote_count: 25000, vote_average: 8.5 },
    { id: 120, title: "El señor de los anillos: La comunidad del anillo", release_date: "2001-12-18", vote_count: 28000, vote_average: 8.4 },
    { id: 121, title: "El señor de los anillos: Las dos torres", release_date: "2002-12-18", vote_count: 24000, vote_average: 8.4 },
  ],
};

const film = (tmdbId: number, year: number, extra: Partial<RutaFilm> = {}): RutaFilm => ({
  tmdbId,
  name: `Film ${tmdbId}`,
  originalName: null,
  year,
  releaseDate: `${year}-06-01`,
  posterPath: null,
  backdropPath: null,
  overview: null,
  voteAverage: 7,
  voteCount: 1000,
  genreIds: [],
  ...extra,
});

describe("seeds", () => {
  it("ranks favoritas, then rating, then the first added; never Quiero ver or series", () => {
    const base = { kind: "MOVIE" as const, watched: true, rating: null, favorite: false };
    const ranked = rankSeeds([
      { ...base, catalogId: "a", tmdbId: 1, name: "Rated 8", rating: 8, createdAt: new Date("2026-10-01") },
      { ...base, catalogId: "b", tmdbId: 2, name: "Queued", watched: false, rating: 10, createdAt: new Date("2026-09-01") },
      { ...base, catalogId: "c", tmdbId: 3, name: "Favorite", favorite: true, createdAt: new Date("2026-10-05") },
      { ...base, catalogId: "d", tmdbId: 4, name: "Series", kind: "SERIES", rating: 10, createdAt: new Date("2026-09-01") },
      { ...base, catalogId: "e", tmdbId: 5, name: "Old unrated", createdAt: new Date("2026-01-01") },
      { ...base, catalogId: "f", tmdbId: 6, name: "New unrated", createdAt: new Date("2026-10-20") },
    ]);
    assert.deepEqual(
      ranked.map((seed) => seed.name),
      ["Favorite", "Rated 8", "Old unrated", "New unrated"],
    );
  });
});

describe("por colección", () => {
  it("cleans the collection name and names the trilogy", () => {
    assert.equal(collectionBaseName("El Señor de los Anillos - Colección"), "El Señor de los Anillos");
    assert.equal(collectionBaseName("Colección Harry Potter"), "Harry Potter");
    assert.equal(collectionBaseName("Dune Collection"), "Dune");
    assert.equal(collectionRutaTitle("El Señor de los Anillos", 3), "El Señor de los Anillos, la trilogía");
    assert.equal(collectionRutaTitle("Harry Potter", 8), "Harry Potter, las ocho");
    assert.equal(filmNameInSaga("El señor de los anillos: Las dos torres", "El Señor de los Anillos"), "Las dos torres");
    assert.equal(filmNameInSaga("Duna", "El Señor de los Anillos"), "Duna");
  });

  it("caso Ivan: the trilogy in order, 1 de 3, Las dos torres next", () => {
    const seen = new Set([120]);
    const draft = collectionRutaDraft(
      LOTR,
      { tmdbId: 120, name: "El señor de los anillos: La comunidad del anillo", favorite: true },
      seen,
      TODAY,
    );
    assert.ok(draft);
    assert.equal(draft.title, "El Señor de los Anillos, la trilogía");
    assert.equal(draft.sourceKey, "coleccion:119");
    assert.deepEqual(draft.steps.map((step) => step.film.tmdbId), [120, 121, 122]);
    assert.equal(draft.steps[0]!.why, "Tu favorita · aquí empezó todo");
    assert.equal(draft.steps[1]!.why, "Sigue justo donde te dejó La comunidad del anillo");
    assert.match(draft.reason, /^Tu favorita es la primera\. Faltan dos/);
    const states = stepStates(draft.steps.map((step) => seen.has(step.film.tmdbId)));
    assert.deepEqual(states, ["done", "next", "hidden"]);
    assert.deepEqual(rutaProgress(states.map((state) => state === "done")), {
      done: 1,
      total: 3,
      nextIndex: 1,
      closed: false,
    });
  });

  it("skips announced parts, short collections and collections already seen", () => {
    const withFuture: TmdbCollectionPayload = {
      ...LOTR,
      parts: [...(LOTR.parts ?? []), { id: 999, title: "La caza de Gollum", release_date: "2027-12-15" }],
    };
    assert.equal(collectionRutaDraft(withFuture, null, new Set(), TODAY)?.steps.length, 3);
    assert.equal(
      collectionRutaDraft({ id: 1, name: "Duna", parts: LOTR.parts!.slice(0, 2) }, null, new Set(), TODAY),
      null,
    );
    assert.equal(collectionRutaDraft(LOTR, null, new Set([120, 121, 122]), TODAY), null);
  });
});

describe("por persona", () => {
  const credits: TmdbCombinedCredits & { crew: Array<Record<string, unknown>>; cast: Array<Record<string, unknown>> } = {
    crew: [
      { id: 1, media_type: "movie", job: "Director", title: "A", release_date: "2009-09-18", vote_count: 9000 },
      { id: 2, media_type: "movie", job: "Director", title: "B", release_date: "2012-03-16", vote_count: 12000 },
      { id: 2, media_type: "movie", job: "Writer", title: "B", release_date: "2012-03-16", vote_count: 12000 },
      { id: 3, media_type: "movie", job: "Director", title: "Short film", release_date: "2010-01-01", vote_count: 12 },
      { id: 4, media_type: "movie", job: "Director", title: "Doc", release_date: "2015-01-01", vote_count: 400, genre_ids: [99] },
      { id: 5, media_type: "tv", job: "Director", name: "Series", first_air_date: "2015-01-01", vote_count: 400 },
      { id: 6, media_type: "movie", job: "Director", title: "Next year", release_date: "2027-05-26", vote_count: 0 },
      { id: 7, media_type: "movie", job: "Director", title: "C", release_date: "2014-02-07", vote_count: 8000 },
    ],
    cast: [
      { id: 8, media_type: "movie", character: "Himself", title: "Making of", release_date: "2014-01-01", vote_count: 300 },
      { id: 9, media_type: "movie", character: "Cop (uncredited)", title: "Cameo", release_date: "2014-01-01", vote_count: 300 },
      { id: 10, media_type: "movie", character: "Ryland Grace", title: "PHM", release_date: "2026-03-15", vote_count: 8000 },
    ],
  };

  it("counts released films with ≥ 50 votes in the role, in release order", () => {
    assert.deepEqual(personRoleFilms(credits, "director", TODAY).map((item) => item.tmdbId), [1, 2, 7]);
    assert.deepEqual(personRoleFilms(credits, "reparto", TODAY).map((item) => item.tmdbId), [10]);
  });

  it("a short filmography is offered whole: «Lord & Miller, los cinco» 1 de 5", () => {
    const films = [film(1, 2009), film(2, 2012), film(3, 2014), film(4, 2014), film(5, 2026)];
    const draft = personRutaDraft({
      name: duoName("Phil Lord", "Christopher Miller"),
      sourceKey: personSourceKey([155267, 107446], "director"),
      role: "director",
      films,
      seed: { tmdbId: 5, name: "Proyecto Fin del Mundo" },
      seenTmdbIds: new Set([5]),
      plural: true,
    });
    assert.ok(draft);
    assert.equal(draft.title, "Lord & Miller, los cinco");
    assert.equal(draft.sourceKey, "persona:107446+155267:director");
    assert.equal(draft.steps.length, 5);
    assert.equal(draft.reason, "Lord & Miller dirigieron Proyecto Fin del Mundo. Son cinco y ya viste una.");
    assert.equal(draft.steps.at(-1)!.why, "Ya la viste: cuenta");
  });

  it("a long one becomes «esenciales» of ≤ 6, keeping what you saw and preferring your platforms", () => {
    const films = Array.from({ length: 22 }, (_, index) =>
      film(100 + index, 2000 + index, { voteAverage: 6 + (index % 5) * 0.3, voteCount: 2000 + index * 10 }),
    );
    // Just under the best ones: streaming on your platforms tips it in.
    films[0] = { ...films[0]!, voteAverage: 7.0 };
    const seen = new Set([121]);
    const onMine = new Set([100]);
    const draft = personRutaDraft({
      name: "Greig Fraser",
      sourceKey: personSourceKey([1], "fotografia"),
      role: "fotografia",
      films,
      seed: { tmdbId: 121, name: "Proyecto Fin del Mundo" },
      seenTmdbIds: seen,
      onMyPlatforms: onMine,
    });
    assert.ok(draft);
    assert.equal(draft.title, "Greig Fraser, esenciales");
    assert.ok(draft.steps.length <= 6);
    assert.ok(draft.steps.some((step) => step.film.tmdbId === 121), "the seen film counts");
    assert.ok(draft.steps.some((step) => step.film.tmdbId === 100), "on your platforms comes first");
    const years = draft.steps.map((step) => step.film.year ?? 0);
    assert.deepEqual(years, [...years].sort((a, b) => a - b));
    assert.match(draft.reason, /Tiene 22; estas son seis/);
  });

  it("needs three films and something left to see", () => {
    assert.equal(
      personRutaDraft({ name: "X", sourceKey: "persona:1:director", role: "director", films: [film(1, 2000), film(2, 2001)], seed: null, seenTmdbIds: new Set() }),
      null,
    );
    assert.equal(
      personRutaDraft({ name: "X", sourceKey: "persona:1:director", role: "director", films: [film(1, 2000), film(2, 2001), film(3, 2002)], seed: null, seenTmdbIds: new Set([1, 2, 3]) }),
      null,
    );
  });

  it("two people with the same work are one duo", () => {
    const a = [film(1, 2009), film(2, 2012), film(3, 2014)];
    assert.equal(isDuo(a, [...a, film(4, 2015)]), false);
    assert.equal(isDuo(a, a), true);
    assert.equal(isDuo(a, [film(9, 2000)]), false);
  });

  it("source keys round-trip", () => {
    assert.deepEqual(parseSourceKey("coleccion:119"), { kind: "coleccion", collectionId: 119 });
    assert.deepEqual(parseSourceKey("persona:107446+155267:director"), {
      kind: "persona",
      personIds: [107446, 155267],
      role: "director",
    });
    assert.equal(parseSourceKey("persona:1:guion"), null);
    assert.equal(parseSourceKey("nada"), null);
  });
});

describe("revelado y sellos de tiempo", () => {
  it("only the next step is face up after the seen ones; a step seen out of order is done", () => {
    assert.deepEqual(stepStates([true, false, false]), ["done", "next", "hidden"]);
    assert.deepEqual(stepStates([false, false, true]), ["next", "hidden", "done"]);
    assert.deepEqual(stepStates([true, true, true]), ["done", "done", "done"]);
  });

  it("«Vi esto» on the next step marks it done, reveals the one after; the last closes", () => {
    const stored = [
      { position: 0, revealedAt: new Date(), doneAt: new Date() },
      { position: 1, revealedAt: new Date(), doneAt: null },
      { position: 2, revealedAt: null, doneAt: null },
    ];
    assert.deepEqual(stampChanges(stored, [true, true, false], null), {
      revealed: [2],
      done: [1],
      undone: [],
      close: false,
    });
    assert.equal(stampChanges(stored, [true, true, true], null).close, true);
    assert.deepEqual(stampChanges(stored, [false, false, false], null).undone, [0]);
  });

  it("never more than two active: the third waits", () => {
    assert.equal(MAX_ACTIVE_RUTAS, 2);
    assert.equal(statusForNewRuta(0), "activa");
    assert.equal(statusForNewRuta(1), "activa");
    assert.equal(statusForNewRuta(2), "espera");
  });
});

describe("Hoy", () => {
  const lens = (slug: string, kind: string, ids: string[]) => ({ slug, kind, titles: ids.map((id) => ({ id })) });

  it("day one (no recommendations): the ruta leads; later it follows Para ti", () => {
    const paraTi = lens("para-ti", "para-ti", ["q1", "step"]);
    const drama = lens("drama-18", "genre", ["q2"]);
    const ruta = lens("ruta-1", "ruta", ["step"]);
    const ids = new Set(["step"]);
    assert.deepEqual(
      placeRutaLenses([paraTi, drama], [ruta], false, ids).map((item) => item.slug),
      ["ruta-1", "para-ti", "drama-18"],
    );
    const placed = placeRutaLenses([paraTi, drama], [ruta], true, ids);
    assert.deepEqual(placed.map((item) => item.slug), ["para-ti", "ruta-1", "drama-18"]);
    assert.deepEqual(placed[0]!.titles.map((title) => title.id), ["q1"], "the step leaves Para ti");
  });
});

describe("el hilo", () => {
  const lesnie = { id: 1, name: "Andrew Lesnie", role: "dp" as const };
  const jackson = { id: 2, name: "Peter Jackson", role: "director" as const };

  it("prefers the person in more of your films and in the next step", () => {
    const thread = findThread(
      { catalogId: "two", name: "Las dos torres", people: [jackson, lesnie] },
      [{ catalogId: "one", name: "La comunidad del anillo", people: [lesnie, jackson] }],
      { catalogId: "three", name: "El retorno del rey", people: [lesnie] },
    );
    assert.ok(thread);
    assert.equal(thread.person.name, "Andrew Lesnie");
    assert.equal(threadLine(thread, 18), "Andrew Lesnie fotografió las dos. Con esta llevas 2 de sus 18.");
  });

  it("no thread when nobody is shared (three islands)", () => {
    assert.equal(
      findThread(
        { catalogId: "a", name: "A", people: [jackson] },
        [{ catalogId: "b", name: "B", people: [lesnie] }],
        null,
      ),
      null,
    );
  });

  it("reads the stored people: crew, composer and the top of the cast only", () => {
    assert.deepEqual(
      parseThreadPeople([
        { id: 1, name: "D", role: "director" },
        { id: 2, name: "P", role: "dp" },
        { id: 3, name: "C1", role: "cast", order: 0 },
        { id: 4, name: "C9", role: "cast", order: 9 },
        { id: 5, name: "M", role: "composer" },
        { id: 6, name: "Cr", role: "creator" },
      ]).map((person) => person.name),
      ["D", "P", "C1", "M"],
    );
  });
});
