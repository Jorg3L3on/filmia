import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { restoreImpliedRatingFor, setImpliedRatingFor } from "@/lib/title-writes";

const seed = seeder("quickrate");

const ratingsOf = async (titleId: string) =>
  db.query.titles.findFirst({ where: eq(titles.id, titleId), columns: { rating: true, impliedRating: true } });

describeWithDb("Me gustó / No tanto en el aviso (FIL-28)", () => {
  let userId = "";
  let stranger = "";
  let unrated = "";
  let rated = "";

  before(async () => {
    userId = await seed.user("Ivan");
    stranger = await seed.user("Otra");
    const dune = await seed.film({ name: "Dune" });
    const arrival = await seed.film({ name: "Arrival" });
    unrated = await seed.title(userId, dune.catalogId, { watchedAt: new Date("2026-10-27T12:00:00Z") });
    rated = await seed.title(userId, arrival.catalogId, { watchedAt: new Date("2026-10-27T12:00:00Z"), rating: 6 });
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("writes 8 for «Me gustó» and 4 for «No tanto», never stars", async () => {
    assert.deepEqual(await setImpliedRatingFor(userId, unrated, "liked"), { written: true, previous: null, titleId: unrated });
    assert.deepEqual(await ratingsOf(unrated), { rating: null, impliedRating: 8 });
    const catalogId = (await db.query.titles.findFirst({ where: eq(titles.id, unrated), columns: { catalogId: true } }))!.catalogId;
    assert.deepEqual(await setImpliedRatingFor(userId, catalogId, "meh"), { written: true, previous: 8, titleId: unrated }, "a catalog id finds the Title");
    assert.deepEqual(await ratingsOf(unrated), { rating: null, impliedRating: 4 });
  });

  it("does not write when the person already gave stars", async () => {
    assert.deepEqual(await setImpliedRatingFor(userId, rated, "liked"), { written: false, previous: null });
    assert.deepEqual(await ratingsOf(rated), { rating: 6, impliedRating: null });
  });

  it("Deshacer puts back what was there", async () => {
    await restoreImpliedRatingFor(userId, unrated, null);
    assert.deepEqual(await ratingsOf(unrated), { rating: null, impliedRating: null });
  });

  it("only touches the person's own titles", async () => {
    await assert.rejects(setImpliedRatingFor(stranger, unrated, "liked"), /no encontrado/i);
    await restoreImpliedRatingFor(stranger, rated, 9);
    assert.deepEqual(await ratingsOf(rated), { rating: 6, impliedRating: null });
  });
});
