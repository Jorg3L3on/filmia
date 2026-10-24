import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies.js";
import { markTitleWatched } from "@/app/actions/watchlist";
import { db, listItems, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session-token";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

process.env.AUTH_SECRET ??= "test-secret-for-mark-title-watched";

const runAsUser = async (userId: string, task: () => Promise<void>) => {
  const token = await createSessionToken(
    { id: userId, email: "nia@filmia.test", name: "Nia" },
    { onboarded: true, sessionVersion: 0 },
  );
  const headerList = new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` });
  const requestCookies = new RequestCookies(headerList);
  const workStore = {
    page: "/titulos/test",
    route: "/titulos/test",
    forceStatic: false,
    dynamicShouldError: false,
  };
  const workUnitStore = {
    type: "request" as const,
    phase: "render" as const,
    implicitTags: { tags: [] as string[], expirationsByCacheKind: new Map() },
    url: { pathname: "/titulos/test", search: "" },
    headers: headerList,
    cookies: requestCookies,
    mutableCookies: requestCookies,
    userspaceMutableCookies: requestCookies,
    rootParams: {},
    resumeDataCache: null,
  };

  await workAsyncStorage.run(workStore as never, () =>
    workUnitAsyncStorage.run(workUnitStore as never, task),
  );
};

describeWithDb("markTitleWatched from the diary (FIL-27)", () => {
  const seed = seeder("t-diary");
  let userId = "";

  const saved = async (titleId: string) => {
    const row = await db.query.titles.findFirst({
      where: eq(titles.id, titleId),
      columns: { rating: true, review: true, platform: true, watchedAt: true },
    });
    assert.ok(row);
    return row;
  };

  before(async () => {
    userId = await seed.user("Nia");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("keeps rating and review when the diary form only sends watchedAt", async () => {
    const film = await seed.film({ name: "Luz de invernadero" });
    const titleId = await seed.title(userId, film.catalogId, {
      rating: 8,
      watchedAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    await db
      .update(titles)
      .set({ review: "Una tarde larga", platform: "NETFLIX" })
      .where(eq(titles.id, titleId));
    await seed.queue(userId, film.catalogId);

    const formData = new FormData();
    formData.set("watchedAt", "2026-10-20");

    await runAsUser(userId, () => markTitleWatched(titleId, formData));

    const row = await saved(titleId);
    assert.deepEqual(
      {
        rating: row.rating,
        review: row.review,
        platform: row.platform,
        watchedAt: row.watchedAt?.toISOString() ?? null,
      },
      {
        rating: 8,
        review: "Una tarde larga",
        platform: "NETFLIX",
        watchedAt: "2026-10-20T12:00:00.000Z",
      },
    );

    const watchlist = await seed.listOf(userId, WATCHLIST_SLUG);
    const queued = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, film.catalogId)),
    });
    assert.equal(queued, undefined);
  });

  it("clears rating and review when those fields are present and empty", async () => {
    const film = await seed.film({ name: "Patio sin reloj" });
    const titleId = await seed.title(userId, film.catalogId, {
      rating: 6,
      watchedAt: new Date("2026-09-02T12:00:00.000Z"),
    });
    await db.update(titles).set({ review: "Nota que se borra" }).where(eq(titles.id, titleId));

    const formData = new FormData();
    formData.set("watchedAt", "2026-10-21");
    formData.set("rating", "");
    formData.set("review", "");

    await runAsUser(userId, () => markTitleWatched(titleId, formData));

    const row = await saved(titleId);
    assert.equal(row.rating, null);
    assert.equal(row.review, null);
    assert.equal(row.watchedAt?.toISOString(), "2026-10-21T12:00:00.000Z");
  });
});
