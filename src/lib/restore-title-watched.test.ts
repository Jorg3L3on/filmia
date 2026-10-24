import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies.js";
import { clearTitleWatched, restoreTitleWatched } from "@/app/actions/watchlist";
import { db, listItems, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session-token";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

process.env.AUTH_SECRET ??= "test-secret-for-restore-title-watched";

const runAsUser = async (userId: string, task: () => Promise<unknown>) => {
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
    incrementalCache: {},
    pendingRevalidatedTags: [] as unknown[],
  };
  const workUnitStore = {
    type: "request" as const,
    phase: "action" as const,
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

describe("restoreTitleWatched stays off markTitleWatched", () => {
  it("requires a session and only fills a null watchedAt", async () => {
    const [actions, writes] = await Promise.all([
      readFile("src/app/actions/watchlist.ts", "utf8"),
      readFile("src/lib/title-writes.ts", "utf8"),
    ]);
    const body = (source: string, name: string) =>
      source.slice(source.indexOf(`export const ${name} =`)).split("\nexport const ")[0] ?? "";
    const action = body(actions, "restoreTitleWatched");
    const impl = body(writes, "restoreWatchedFor");
    assert.match(action, /requireUserId\(\)/);
    assert.match(action, /restoreWatchedFor\(userId, titleId, isoDate\)/);
    assert.doesNotMatch(action, /markTitleWatched|markWatchedFor/);
    assert.match(impl, /isNull\(titles\.watchedAt\)/);
    assert.match(impl, /isValidIsoDate\(isoDate\)/);
    assert.doesNotMatch(impl, /markWatchedFor|listItems/);
  });
});

describeWithDb("restoreTitleWatched (FIL-I29-1)", () => {
  const seed = seeder("t-restore");
  let userId = "";
  let otherId = "";

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
    otherId = await seed.user("Leo");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("returns the original day after clear and keeps rating, review, platform, and Quiero ver", async () => {
    const film = await seed.film({ name: "Luz de invernadero" });
    const titleId = await seed.title(userId, film.catalogId, {
      rating: 8,
      watchedAt: new Date("2026-09-14T12:00:00.000Z"),
    });
    await db
      .update(titles)
      .set({ review: "Una tarde larga", platform: "NETFLIX" })
      .where(eq(titles.id, titleId));
    await seed.queue(userId, film.catalogId);

    await runAsUser(userId, () => clearTitleWatched(titleId));
    const cleared = await saved(titleId);
    assert.equal(cleared.watchedAt, null);
    assert.equal(cleared.rating, 8);
    assert.equal(cleared.review, "Una tarde larga");
    assert.equal(cleared.platform, "NETFLIX");

    let restored = "";
    await runAsUser(userId, async () => {
      restored = await restoreTitleWatched(titleId, "2026-09-14");
    });
    assert.equal(restored, "2026-09-14");

    const row = await saved(titleId);
    assert.equal(row.watchedAt?.toISOString(), "2026-09-14T12:00:00.000Z");
    assert.equal(row.rating, 8);
    assert.equal(row.review, "Una tarde larga");
    assert.equal(row.platform, "NETFLIX");

    const watchlist = await seed.listOf(userId, WATCHLIST_SLUG);
    const queued = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, watchlist.id), eq(listItems.catalogId, film.catalogId)),
    });
    assert.ok(queued);
  });

  it("does not overwrite a date that is already set", async () => {
    const film = await seed.film({ name: "Patio sin reloj" });
    const titleId = await seed.title(userId, film.catalogId, {
      rating: 6,
      watchedAt: new Date("2026-10-02T12:00:00.000Z"),
    });

    await assert.rejects(
      runAsUser(userId, () => restoreTitleWatched(titleId, "2026-09-01")),
    );

    const row = await saved(titleId);
    assert.equal(row.watchedAt?.toISOString(), "2026-10-02T12:00:00.000Z");
    assert.equal(row.rating, 6);
  });

  it("rejects an invalid date and someone else's title", async () => {
    const film = await seed.film({ name: "Carta al faro" });
    const titleId = await seed.title(userId, film.catalogId, {
      watchedAt: new Date("2026-08-01T12:00:00.000Z"),
    });
    await runAsUser(userId, () => clearTitleWatched(titleId));

    await assert.rejects(runAsUser(userId, () => restoreTitleWatched(titleId, "2026-02-31")));
    await assert.rejects(runAsUser(userId, () => restoreTitleWatched(titleId, "no-es-fecha")));
    await assert.rejects(runAsUser(otherId, () => restoreTitleWatched(titleId, "2026-08-01")));
    await assert.rejects(() => restoreTitleWatched(titleId, "2026-08-01"));

    const row = await saved(titleId);
    assert.equal(row.watchedAt, null);

    const watchlist = await seed.listOf(userId, WATCHLIST_SLUG);
    const queued = await db.query.listItems.findMany({
      where: eq(listItems.listId, watchlist.id),
    });
    assert.equal(queued.some((item) => item.catalogId === film.catalogId), false);
  });
});
