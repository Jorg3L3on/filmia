import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { createId } from "@paralleldrive/cuid2";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, pickEvents, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import type { RecoEntry } from "@/lib/tonight/compose";
import type { TonightCard } from "@/lib/tonight-store";
import { flipOculta, loadOcultaLens } from "./oculta";
import { answerViste, visteStatus } from "./viste";

const seed = seeder("piezas");

/** A recommendation as `loadOcultaLens` reads it: an id, a reco seed and the two components. */
const entry = (catalogId: string, gusto: number, calidad: number) =>
  ({
    card: { id: catalogId, reco: { seedName: "Semilla" }, reasons: [] },
    scored: { pick: { components: { gusto, calidad } } },
  }) as unknown as RecoEntry<TonightCard>;

describeWithDb("Piezas · la oculta y ¿las viste? (FIL-I26-3)", () => {
  let userId = "";
  let films: Array<{ catalogId: string; tmdbId: number }> = [];

  before(async () => {
    userId = await seed.user("Ivan", ["MAX"]);
    films = [];
    for (let index = 0; index < 6; index += 1) {
      films.push(await seed.film({ name: `Film ${index}`, year: 2000 + index, platforms: ["MAX"] }));
    }
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  const day = (n: number) => new Date(`2026-10-${String(20 + n).padStart(2, "0")}T18:00:00Z`);
  const pool = () => [entry(films[0]!.catalogId, 0.9, 0.9), entry(films[1]!.catalogId, 0.2, 0.95), entry(films[2]!.catalogId, 0.3, 0.8), entry(films[3]!.catalogId, 0.1, 0.7)];
  const ocultaOn = async (n: number) =>
    (await loadOcultaLens(userId, ["MAX"], day(n), { recos: pool(), deckIds: new Set() }))?.titles[0] ?? null;

  it("one a day: the same card all day, face down until flipped", async () => {
    const first = await ocultaOn(1);
    assert.equal(first?.id, films[1]!.catalogId);
    assert.equal(first?.oculta?.flipped, false);
    assert.equal((await ocultaOn(1))?.id, first?.id, "does not change within the day");
    assert.equal(await flipOculta(userId, first!.id, day(1)), true);
    assert.equal((await ocultaOn(1))?.oculta?.flipped, true);
  });

  it("a different one the next day, never one dealt before, and none once today's is seen", async () => {
    const second = await ocultaOn(2);
    assert.equal(second?.id, films[2]!.catalogId);
    await seed.title(userId, second!.id, { watchedAt: day(2) });
    assert.equal(await ocultaOn(2), null, "seen today: no oculta until tomorrow");
    const third = await ocultaOn(3);
    assert.equal(third?.id, films[3]!.catalogId);
    assert.notEqual(third?.id, films[1]!.catalogId);
  });

  it("refuses to flip a card that was never dealt", async () => {
    assert.equal(await flipOculta(userId, films[5]!.catalogId), false);
  });

  it("answers: «me gustó» and «no tanto» are watched with a rating Afinidad reads, «no la vi» writes nothing", async () => {
    const now = day(4);
    for (const [index, film] of [films[0], films[4], films[5]].entries()) {
      await db.insert(pickEvents).values({
        id: createId(),
        userId,
        titleId: null,
        catalogId: film!.catalogId,
        kind: "viste_dealt",
        lens: "las-viste:Semilla",
        createdAt: new Date(now.getTime() - 1000 + index),
      });
    }
    // Already rated by the person: their rating stays.
    await seed.title(userId, films[0]!.catalogId, { rating: 10 });

    const liked = await answerViste(userId, films[0]!.catalogId, "liked", now);
    assert.ok(liked.ok && liked.remaining === 2 && liked.summary === null);
    const meh = await answerViste(userId, films[4]!.catalogId, "meh", now);
    assert.ok(meh.ok && meh.remaining === 1);
    const no = await answerViste(userId, films[5]!.catalogId, "no", now);
    assert.ok(no.ok && no.remaining === 0 && typeof no.summary === "string");

    const own = await db.query.titles.findMany({ where: eq(titles.userId, userId), columns: { catalogId: true, rating: true, watchedAt: true } });
    const byCatalog = new Map(own.map((row) => [row.catalogId, row]));
    assert.equal(byCatalog.get(films[0]!.catalogId)?.rating, 10, "never over the person's own rating");
    assert.ok(byCatalog.get(films[0]!.catalogId)?.watchedAt);
    assert.equal(byCatalog.get(films[4]!.catalogId)?.rating, 4);
    assert.ok(byCatalog.get(films[4]!.catalogId)?.watchedAt);
    assert.equal(byCatalog.has(films[5]!.catalogId), false);

    assert.deepEqual(await visteStatus(userId, now), { answered: 3, done: true });
    const again = await answerViste(userId, films[5]!.catalogId, "liked", now);
    assert.equal(again.ok, false);
    const notDealt = await answerViste(userId, films[3]!.catalogId, "liked", now);
    assert.equal(notDealt.ok, false);
    const events = await db.query.pickEvents.findMany({
      where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "viste_answered")),
    });
    assert.deepEqual(events.map((event) => event.lens).sort(), ["viste:liked", "viste:meh", "viste:no"]);
  });
});
