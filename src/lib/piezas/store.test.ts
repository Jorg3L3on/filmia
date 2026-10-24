import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { createId } from "@paralleldrive/cuid2";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, pickEvents, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { answerViste, visteStatus } from "./viste";

const seed = seeder("piezas");

describeWithDb("¿Las viste? · store (FIL-I26-3)", () => {
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

    assert.deepEqual(await visteStatus(userId, now), { answered: 3 });
    const again = await answerViste(userId, films[5]!.catalogId, "liked", now);
    assert.equal(again.ok, false);
    const notDealt = await answerViste(userId, films[3]!.catalogId, "liked", now);
    assert.equal(notDealt.ok, false);
    const events = await db.query.pickEvents.findMany({
      where: and(eq(pickEvents.userId, userId), eq(pickEvents.kind, "viste_answered")),
    });
    assert.deepEqual(events.map((event) => event.lens).sort(), ["viste:liked", "viste:meh", "viste:no"]);
  });

  it("no daily limit: a second batch the same day is answered like the first, its own summary at the end", async () => {
    const now = day(4);
    const more = [films[1], films[2], films[3]];
    for (const [index, film] of more.entries()) {
      await db.insert(pickEvents).values({
        id: createId(),
        userId,
        titleId: null,
        catalogId: film!.catalogId,
        kind: "viste_dealt",
        lens: "las-viste:Otra",
        createdAt: new Date(now.getTime() + 1000 + index),
      });
    }
    const first = await answerViste(userId, films[1]!.catalogId, "no", now);
    assert.ok(first.ok && first.remaining === 2 && first.summary === null);
    await answerViste(userId, films[2]!.catalogId, "no", now);
    const last = await answerViste(userId, films[3]!.catalogId, "no", now);
    assert.ok(last.ok && last.remaining === 0);
    assert.equal(last.summary, "Ninguna de estas. Sigue con otras tres.", "the summary covers this batch only");
    assert.deepEqual(await visteStatus(userId, now), { answered: 6 });
  });
});
