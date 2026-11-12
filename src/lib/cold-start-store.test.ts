import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, serviceCharts, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { answerAfina, countUserSignals, loadAfinaCards } from "@/lib/cold-start-store";
import { seeder } from "@/lib/test-support/seed";

const seed = seeder("afina");
// A platform TMDB returns nothing for in MX: no real chart rows to collide with.
const PLATFORM = "LIONSGATE" as const;

describeWithDb("Afina tu gusto (FIL-I47-3)", () => {
  let userId = "";
  let almost = "";
  const films: string[] = [];
  let offChart = "";

  before(async () => {
    userId = await seed.user("Nueva", [PLATFORM]);
    almost = await seed.user("Casi", [PLATFORM]);
    for (const name of ["Uno", "Dos", "Tres", "Cuatro"]) {
      films.push((await seed.film({ name, platforms: [PLATFORM] })).catalogId);
    }
    offChart = (await seed.film({ name: "Fuera" })).catalogId;
    await db.delete(serviceCharts).where(eq(serviceCharts.platform, PLATFORM));
    await db.insert(serviceCharts).values(
      films.map((catalogId, index) => ({
        platform: PLATFORM,
        kind: "MOVIE" as const,
        rank: index + 1,
        catalogId,
        source: "popularity",
        period: "2026-11-10",
      })),
    );
    // Nine signals already: the next answer is the tenth.
    for (let index = 0; index < 9; index += 1) {
      const film = await seed.film({ name: `Cola ${index}` });
      await seed.queue(almost, film.catalogId, index);
    }
  });

  after(async () => {
    await db.delete(serviceCharts).where(eq(serviceCharts.platform, PLATFORM));
    await seed.cleanup();
    await closeLocalPg();
  });

  const impliedOf = async (catalogId: string) =>
    db.query.titles.findFirst({
      where: and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)),
      columns: { impliedRating: true, rating: true, watchedAt: true },
    });

  it("raises the meter by one per answer and writes the implied rating", async () => {
    assert.equal(await countUserSignals(userId), 0);
    assert.deepEqual(await answerAfina(userId, [PLATFORM], films[0]!, "liked"), { ok: true, signals: 1, reachedGoal: false });
    assert.deepEqual(await answerAfina(userId, [PLATFORM], films[1]!, "meh"), { ok: true, signals: 2, reachedGoal: false });
    assert.deepEqual(await answerAfina(userId, [PLATFORM], films[2]!, "no"), { ok: true, signals: 3, reachedGoal: false });

    const liked = await impliedOf(films[0]!);
    assert.equal(liked?.impliedRating, 8);
    assert.equal(liked?.rating, null, "never stars");
    assert.ok(liked?.watchedAt, "«La vi» marks it watched");
    assert.equal((await impliedOf(films[1]!))?.impliedRating, 4);
    assert.equal(await impliedOf(films[2]!), undefined, "«No la he visto» writes no title");
  });

  it("never asks the same title twice", async () => {
    const again = await answerAfina(userId, [PLATFORM], films[2]!, "liked");
    assert.equal(again.ok, false);
    const cards = await loadAfinaCards(userId, [PLATFORM]);
    assert.deepEqual(cards.map((card) => card.catalogId), [films[3]]);
  });

  it("refuses a title that is not on the user's charts", async () => {
    const outcome = await answerAfina(userId, [PLATFORM], offChart, "liked");
    assert.equal(outcome.ok, false);
    assert.equal((await answerAfina(userId, [], films[3]!, "liked")).ok, false);
  });

  it("says the goal was reached on the tenth signal", async () => {
    assert.equal(await countUserSignals(almost), 9);
    assert.deepEqual(await answerAfina(almost, [PLATFORM], films[0]!, "no"), { ok: true, signals: 10, reachedGoal: true });
    assert.deepEqual(await answerAfina(almost, [PLATFORM], films[1]!, "no"), { ok: true, signals: 11, reachedGoal: false });
  });
});
