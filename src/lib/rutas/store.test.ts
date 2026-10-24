import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db, pickEvents, rutaPasos, rutas, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import type { RutaDraft, RutaFilm } from "./core";
import { createRuta, loadRutas, parkRuta, activateRuta } from "./store";

const seed = seeder("rutas");

const filmOf = (tmdbId: number, name: string, year: number): RutaFilm => ({
  tmdbId,
  name,
  originalName: null,
  year,
  releaseDate: `${year}-01-01`,
  posterPath: null,
  backdropPath: null,
  overview: null,
  voteAverage: 8,
  voteCount: 1000,
  genreIds: [],
});

describeWithDb("Rutas · store (FIL-I26-1)", () => {
  let userId = "";
  let films: Array<{ catalogId: string; tmdbId: number }> = [];
  const draft = (key: string, picks: number[]): RutaDraft => ({
    kind: "coleccion",
    title: `Ruta ${key}`,
    shortTitle: key,
    reason: "Prueba.",
    sourceKey: `coleccion:${key}`,
    seedTmdbId: films[picks[0]!]!.tmdbId,
    steps: picks.map((index) => ({
      film: filmOf(films[index]!.tmdbId, `Film ${index}`, 2000 + index),
      why: `Paso ${index}`,
      hint: `Pista ${index}`,
    })),
  });
  const watch = (catalogId: string) =>
    db.update(titles).set({ watchedAt: new Date() }).where(and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)));

  before(async () => {
    userId = await seed.user("Ivan", ["MAX"]);
    films = [];
    for (let index = 0; index < 9; index += 1) {
      films.push(await seed.film({ name: `Film ${index}`, year: 2000 + index }));
    }
    // Ivan saw film 0 (his favorita) and has film 1 saved, unseen.
    await seed.title(userId, films[0]!.catalogId, { watchedAt: new Date(), rating: 10 });
    await seed.title(userId, films[1]!.catalogId);
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("stores a ruta with what is seen already done, the next revealed and the rest face down", async () => {
    const created = await createRuta(userId, draft("a", [0, 1, 2]), { via: "hoy" });
    assert.equal(created.created, true);
    assert.equal(created.status, "activa");
    const [view] = await loadRutas(userId, { ids: [created.id] });
    assert.ok(view);
    assert.deepEqual(view.steps.map((step) => step.state), ["done", "next", "hidden"]);
    assert.deepEqual(view.progress, { done: 1, total: 3, nextIndex: 1, closed: false });
    assert.equal(view.steps[1]!.titleId != null, true, "the saved film is the person's title");
    const steps = await db.query.rutaPasos.findMany({ where: eq(rutaPasos.rutaId, created.id) });
    assert.ok(steps.find((step) => step.position === 0)?.doneAt);
    assert.ok(steps.find((step) => step.position === 1)?.revealedAt);
    assert.equal(steps.find((step) => step.position === 2)?.revealedAt, null);
    const started = await db.query.pickEvents.findMany({
      where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "ruta_started")),
    });
    assert.equal(started.length, 1);
    assert.equal(started[0]!.lens, "ruta:coleccion:hoy");
  });

  it("the same source twice returns the ruta it already has", async () => {
    const again = await createRuta(userId, draft("a", [0, 1, 2]));
    assert.equal(again.created, false);
  });

  it("never more than two active: the third waits", async () => {
    const second = await createRuta(userId, draft("b", [3, 4, 5]));
    const third = await createRuta(userId, draft("c", [6, 7, 8]));
    assert.equal(second.status, "activa");
    assert.equal(third.status, "espera");
    const active = await db.query.rutas.findMany({ where: and(eq(rutas.userId, userId), eq(rutas.status, "activa")) });
    assert.equal(active.length, 2);
  });

  it("a step watched anywhere counts: done, one event, the next flips", async () => {
    const [ruta] = await db.query.rutas.findMany({ where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, "coleccion:a")) });
    await watch(films[1]!.catalogId);
    const [view] = await loadRutas(userId, { ids: [ruta!.id] });
    assert.deepEqual(view!.steps.map((step) => step.state), ["done", "done", "next"]);
    const done = await db.query.pickEvents.findMany({
      where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "ruta_step_done")),
    });
    assert.equal(done.length, 1);
    // Reading again writes nothing new.
    await loadRutas(userId, { ids: [ruta!.id] });
    assert.equal(
      (await db.query.pickEvents.findMany({ where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "ruta_step_done")) })).length,
      1,
    );
  });

  it("an undo clears the stamp while the ruta is open", async () => {
    const [ruta] = await db.query.rutas.findMany({ where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, "coleccion:a")) });
    await db.update(titles).set({ watchedAt: null }).where(and(eq(titles.userId, userId), eq(titles.catalogId, films[1]!.catalogId)));
    const [view] = await loadRutas(userId, { ids: [ruta!.id] });
    assert.deepEqual(view!.steps.map((step) => step.state), ["done", "next", "hidden"]);
    assert.equal(view!.steps[1]!.doneAt, null);
    await watch(films[1]!.catalogId);
  });

  it("the last step closes the ruta and the oldest waiting one takes its place", async () => {
    const [ruta] = await db.query.rutas.findMany({ where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, "coleccion:a")) });
    await seed.title(userId, films[2]!.catalogId, { watchedAt: new Date() });
    const [view] = await loadRutas(userId, { ids: [ruta!.id] });
    assert.equal(view!.status, "cerrada");
    assert.equal(view!.progress.closed, true);
    const waiting = await db.query.rutas.findFirst({ where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, "coleccion:c")) });
    assert.equal(waiting!.status, "activa", "promoted without a push");
    const closed = await db.query.pickEvents.findMany({
      where: and(eq(pickEvents.userId, userId), inArray(pickEvents.kind, ["ruta_closed"])),
    });
    assert.equal(closed.length, 1);
  });

  it("a seasonal ruta past its last day is archived in silence (one event, no push), out of Hoy", async () => {
    const seasonal = await createRuta(userId, { ...draft("e", [4, 5, 7]), sourceKey: "temporada:e", kind: "temporada", endsOn: "2026-10-31" });
    const [inside] = await loadRutas(userId, { ids: [seasonal.id], now: new Date("2026-11-01T05:00:00Z") });
    assert.notEqual(inside!.status, "archivada", "still the 31st in Mexico City");
    const [past] = await loadRutas(userId, { ids: [seasonal.id], now: new Date("2026-11-01T07:00:00Z") });
    assert.equal(past!.status, "archivada");
    const archived = await db.query.pickEvents.findMany({
      where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "ruta_archived")),
    });
    assert.equal(archived.length, 1);
    const active = await loadRutas(userId, { statuses: ["activa"], now: new Date("2026-11-01T07:00:00Z") });
    assert.ok(active.every((view) => view.id !== seasonal.id));
  });

  it("parks and resumes, and resuming respects the two in Hoy", async () => {
    const [b] = await db.query.rutas.findMany({ where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, "coleccion:b")) });
    assert.equal(await parkRuta(userId, b!.id), true);
    assert.equal(await activateRuta(userId, b!.id), true);
    await createRuta(userId, { ...draft("d", [3, 6, 7]), sourceKey: "coleccion:d" });
    const [d] = await db.query.rutas.findMany({ where: and(eq(rutas.userId, userId), eq(rutas.sourceKey, "coleccion:d")) });
    assert.equal(d!.status, "espera");
    assert.equal(await activateRuta(userId, d!.id), false);
  });
});
