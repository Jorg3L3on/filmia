import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { applyYearPicks, removeWatchlistPick } from "@/app/actions/onboarding";
import { db, titles, users } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { describeWithDb } from "@/lib/test-support/local-db";
import { runAsUser } from "@/lib/test-support/run-as-user";
import { seeder } from "@/lib/test-support/seed";

const exists = async (titleId: string) =>
  Boolean(await db.query.titles.findFirst({ where: eq(titles.id, titleId), columns: { id: true } }));

describeWithDb("onboarding undo never deletes the user's own titles (FIL-I41-10)", () => {
  const seed = seeder("t-onb-undo");
  let onboarded = "";
  let fresh = "";

  before(async () => {
    onboarded = await seed.user("Olga");
    fresh = await seed.user("Fede");
    await db.update(users).set({ onboardedAt: null }).where(eq(users.id, fresh));
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("removeWatchlistPick(createdByFlow: true) keeps an onboarded user's rated, reviewed title", async () => {
    const film = await seed.film({ name: "Río de cal" });
    const titleId = await seed.title(onboarded, film.catalogId, {
      rating: 9,
      watchedAt: new Date("2026-09-03T12:00:00.000Z"),
    });
    await db.update(titles).set({ review: "La vi dos veces" }).where(eq(titles.id, titleId));

    await runAsUser(onboarded, () => removeWatchlistPick(titleId, true));

    assert.equal(await exists(titleId), true);
    const row = await db.query.titles.findFirst({ where: eq(titles.id, titleId) });
    assert.equal(row?.rating, 9);
    assert.equal(row?.review, "La vi dos veces");
  });

  it("applyYearPicks(to: none, createdByFlow: true) keeps an onboarded user's title", async () => {
    const film = await seed.film({ name: "Sal de octubre" });
    const titleId = await seed.title(onboarded, film.catalogId, {
      rating: 8,
      watchedAt: new Date("2026-08-10T12:00:00.000Z"),
    });

    const outcomes = await runAsUser(onboarded, () =>
      applyYearPicks([
        { tmdbId: film.tmdbId, kind: "MOVIE", name: "Sal de octubre", to: "none", titleId, createdByFlow: true },
      ]),
    );

    assert.equal(await exists(titleId), true);
    assert.equal(outcomes[0]?.titleId, titleId);
    const row = await db.query.titles.findFirst({ where: eq(titles.id, titleId) });
    assert.equal(row?.rating, 8);
  });

  it("inside an open Bienvenida, undoing a pick the flow created still removes it", async () => {
    const film = await seed.film({ name: "Casa de vidrio" });
    const titleId = await seed.title(fresh, film.catalogId);
    await seed.queue(fresh, film.catalogId);

    await runAsUser(fresh, () => removeWatchlistPick(titleId, true), { onboarded: false });
    assert.equal(await exists(titleId), false);

    const yearFilm = await seed.film({ name: "Patio norte" });
    const yearTitle = await seed.title(fresh, yearFilm.catalogId, {
      rating: 10,
      watchedAt: new Date("2026-10-01T12:00:00.000Z"),
    });
    const outcomes = await runAsUser(
      fresh,
      () =>
        applyYearPicks([
          { tmdbId: yearFilm.tmdbId, kind: "MOVIE", name: "Patio norte", to: "none", titleId: yearTitle, createdByFlow: true },
        ]),
      { onboarded: false },
    );
    assert.equal(await exists(yearTitle), false);
    assert.equal(outcomes[0]?.titleId, null);

    const watchlist = await seed.listOf(fresh, WATCHLIST_SLUG);
    assert.ok(watchlist);
  });

  it("inside an open Bienvenida, a reviewed title is not deleted", async () => {
    const film = await seed.film({ name: "Faro sin luz" });
    const titleId = await seed.title(fresh, film.catalogId, { rating: 7 });
    await db.update(titles).set({ review: "Escrita antes" }).where(eq(titles.id, titleId));

    await runAsUser(fresh, () => removeWatchlistPick(titleId, true), { onboarded: false });
    assert.equal(await exists(titleId), true);
  });
});
