import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { catalog, db, juegoRondas } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { DIARIA_MIN_VOTES } from "@/lib/juegos/diarias/core";
import { cellOf, CUADRICULA_ID, validFilms, type GridRound } from "@/lib/juegos/diarias/cuadricula";
import { answerCuadricula, loadRarities, makeGrid, openCuadricula, type CuadriculaSources } from "@/lib/juegos/diarias/cuadricula-store";
import type { TmdbCombinedCredits } from "@/lib/person-filmography";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

const GENRES = [18, 35, 28, 878, 53, 80, 12, 10749, 14, 16];

/** Fictitious TMDB credits: five people, 40 movies each (overlapping), plus a talk show and a «Himself». */
const creditsOf = (personId: number): TmdbCombinedCredits => {
  const base = (personId - 1) * 25;
  const movies = Array.from({ length: 40 }, (_, index) => {
    const n = base + index;
    return {
      id: 900_000 + n,
      media_type: "movie",
      title: `Cinta ${n}`,
      release_date: `${1975 + ((n * 7) % 50)}-05-01`,
      genre_ids: [GENRES[n % GENRES.length]!, GENRES[(n * 3 + 1) % GENRES.length]!],
      vote_count: n % 4 === 0 ? 10 : 5000,
      poster_path: `/cinta${n}.jpg`,
    };
  });
  const extras = [
    { id: 1, media_type: "tv", name: "Programa", first_air_date: "2001-01-01" },
    { id: 2, media_type: "movie", title: "Detrás de cámaras", release_date: "2002-01-01", character: "Himself", vote_count: 9000 },
  ];
  return personId % 2 === 0
    ? { crew: movies.map((movie) => ({ ...movie, job: "Director" })) }
    : { cast: [...movies.map((movie) => ({ ...movie, character: "Alguien" })), ...extras] };
};

/** FIL-I54-4 · La cuadrícula on the local database, with fictitious TMDB credits (no network). */
describeWithDb("La cuadrícula store (FIL-I54-4)", () => {
  const seed = seeder("t-cuadricula");
  const now = new Date("2031-04-13T18:00:00Z");
  const day = "2031-04-13";
  const users: string[] = [];
  let calls = 0;
  const sources: CuadriculaSources = {
    candidates: async () => [1, 2, 3, 4, 5].map((id) => ({ id, name: `Persona ${id}`, role: id % 2 === 0 ? ("director" as const) : ("cast" as const) })),
    credits: async (id) => {
      calls += 1;
      return { name: `Persona ${id}`, credits: creditsOf(id) };
    },
  };
  const cleanRounds = () => db.delete(juegoRondas).where(and(eq(juegoRondas.juego, CUADRICULA_ID), eq(juegoRondas.day, day)));
  const round = async () => (await db.query.juegoRondas.findFirst({ where: and(eq(juegoRondas.juego, CUADRICULA_ID), eq(juegoRondas.day, day)) }))!.content as GridRound;

  before(async () => {
    await cleanRounds();
    for (const name of ["Ana", "Beto", "Caro", "Dani", "Eli", "Fer"]) users.push(await seed.user(name));
    // One of the movies is in Catalog: its es-MX name, runtime and IMDb come from there.
    const film = await seed.film({ name: "Cinta en español", runtime: 151 });
    await db.update(catalog).set({ tmdbId: 900_003, imdbRating: 8.4, imdbVotes: DIARIA_MIN_VOTES + 1 }).where(eq(catalog.id, film.catalogId));
  });

  after(async () => {
    await cleanRounds();
    await seed.cleanup();
    await closeLocalPg();
  });

  it("makes the grid from at most twelve filmographies and keeps them out of the view", async () => {
    calls = 0;
    const made = await makeGrid("prueba", sources);
    assert.ok(made.round);
    assert.ok(made.fetched <= 12 && calls === made.fetched);
    const cinta = made.round.rows.flatMap((row) => row.films).find((film) => film.t === 900_003);
    if (cinta) assert.deepEqual([cinta.n, cinta.r, cinta.i], ["Cinta en español", 151, 8.4]);
    for (const row of made.round.rows) {
      assert.ok(!row.films.some((film) => film.t === 1 || film.t === 2), "no series, no «Himself»");
    }

    const opened = await openCuadricula(users[0]!, now, sources, () => true);
    if (opened.status !== "ok") return assert.fail("not opened");
    const json = JSON.stringify(opened.view);
    assert.ok(!json.includes("Cinta "), "no filmography travels to the client");
    assert.equal(opened.view.rows.length, 3);
    assert.equal(opened.view.cols.length, 3);
    assert.equal(opened.view.rarity, null);
  });

  it("a film already in another cell is refused without spending a try; nine tries end it", async () => {
    const opened = await openCuadricula(users[0]!, now, sources, () => true);
    if (opened.status !== "ok") return assert.fail("not opened");
    const r = await round();
    // A film valid in two cells.
    let shared: { a: number; b: number; t: number } | null = null;
    for (let a = 0; a < 9 && !shared; a += 1) {
      const inA = new Set(validFilms(cellOf(r, a)!.person, cellOf(r, a)!.condition).map((film) => film.t));
      for (let b = 0; b < 9 && !shared; b += 1) {
        if (b === a) continue;
        const both = validFilms(cellOf(r, b)!.person, cellOf(r, b)!.condition).find((film) => inA.has(film.t));
        if (both) shared = { a, b, t: both.t };
      }
    }
    assert.ok(shared, "the fixture has a film valid in two cells");
    let view = opened.view;
    const first = await answerCuadricula(users[0]!, view.partidaId, view.step, shared.a, { tmdbId: shared.t, name: "Compartida" }, now);
    assert.ok(first.ok && first.correct);
    view = first.view;
    assert.equal(view.tries, 1);
    const again = await answerCuadricula(users[0]!, view.partidaId, view.step, shared.b, { tmdbId: shared.t, name: "Compartida" }, now);
    assert.equal(again.ok, false);
    assert.equal(again.view?.tries, 1, "the try was not spent");
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const wrong = await answerCuadricula(users[0]!, view.partidaId, view.step, (shared.a + 1) % 9, { tmdbId: 7, name: "Nada que ver" }, now);
      assert.ok(wrong.ok && !wrong.correct);
      view = wrong.view;
    }
    assert.ok(view.finished);
    assert.equal(view.score, 1);
    assert.equal(view.tries, 9);
  });

  it("rarity: «pocos datos» below five players, percentages from five", async () => {
    const r = await round();
    const someFilm = (cell: number) => validFilms(cellOf(r, cell)!.person, cellOf(r, cell)!.condition)[0]!.t;
    for (const [index, userId] of users.slice(1).entries()) {
      const opened = await openCuadricula(userId, now, sources, () => true);
      if (opened.status !== "ok") return assert.fail("not opened");
      const outcome = await answerCuadricula(userId, opened.view.partidaId, opened.view.step, 4, { tmdbId: someFilm(4), name: "Centro" }, now);
      assert.ok(outcome.ok && outcome.correct);
      // Ana (finished) + `index + 1` players so far.
      const players = index + 2;
      assert.equal(outcome.view.players, players);
      if (players < 5) {
        assert.equal(outcome.view.rarity, null);
        assert.equal(outcome.view.cells[4]!.film?.rarity, null);
      } else {
        assert.equal(typeof outcome.view.rarity, "number");
        assert.equal(outcome.view.cells[4]!.film?.rarity, Math.round(((players - 1) / players) * 100));
      }
    }
    const rarities = await loadRarities(day);
    assert.equal(rarities.size, 6);
    assert.ok([...rarities.values()].every((value) => typeof value === "number"));
  });
});
