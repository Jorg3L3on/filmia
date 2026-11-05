import "@/lib/test-support/node-async-local-storage";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { markTmdbTitleWatched, rateTmdbTitle } from "@/app/actions/title-preview";
import { db, titles } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { publicErrorMessage } from "@/lib/public-error";
import { describeWithDb } from "@/lib/test-support/local-db";
import { runAsUser } from "@/lib/test-support/run-as-user";
import { seeder } from "@/lib/test-support/seed";

describe("publicErrorMessage (FIL-I41-8)", () => {
  it("keeps our own copy and hides database errors", () => {
    const original = console.error;
    console.error = () => {};
    try {
      assert.equal(publicErrorMessage(new Error("Título no encontrado."), "x"), "Título no encontrado.");
      const sql = new DrizzleQueryError('insert into "Title" ("id") values ($1)', ["abc"], new Error("duplicate key"));
      assert.equal(publicErrorMessage(sql, "No se pudo guardar."), "No se pudo guardar.");
      const pg = Object.assign(new Error('duplicate key value violates unique constraint "Title_userId_catalogId_key"'), { code: "23505" });
      assert.equal(publicErrorMessage(pg, "No se pudo guardar."), "No se pudo guardar.");
      assert.equal(publicErrorMessage("boom", "No se pudo guardar."), "No se pudo guardar.");
    } finally {
      console.error = original;
    }
  });
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describeWithDb("two «Vi esto» / «Nota» taps at once from a ficha preview (FIL-I41-8)", () => {
  const seed = seeder("t-preview-race");
  let userId = "";

  before(async () => {
    userId = await seed.user("Rita");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  const rowsFor = (catalogId: string) =>
    db.query.titles.findMany({ where: and(eq(titles.userId, userId), eq(titles.catalogId, catalogId)) });

  it("markTmdbTitleWatched twice: both ok with the same titleId, one row", async () => {
    for (let round = 0; round < 4; round += 1) {
      const film = await seed.film({ name: `Doble toque ${round}` });
      const snapshot = { tmdbId: film.tmdbId, kind: film.kind, name: `Doble toque ${round}` };
      const call = () =>
        runAsUser(userId, () => markTmdbTitleWatched(snapshot, form({ watchedAt: "2026-11-04", rating: "8" })));
      const [a, b] = await Promise.all([call(), call()]);
      assert.deepEqual([a.ok, b.ok], [true, true], JSON.stringify([a, b]));
      assert.equal(a.ok && b.ok && a.titleId === b.titleId, true);
      const rows = await rowsFor(film.catalogId);
      assert.equal(rows.length, 1);
      assert.ok(rows[0]?.watchedAt);
    }
  });

  it("rateTmdbTitle twice: both ok with the same titleId, one row", async () => {
    for (let round = 0; round < 4; round += 1) {
      const film = await seed.film({ name: `Nota doble ${round}` });
      const snapshot = { tmdbId: film.tmdbId, kind: film.kind, name: `Nota doble ${round}` };
      const call = () => runAsUser(userId, () => rateTmdbTitle(snapshot, form({ rating: "7" })));
      const [a, b] = await Promise.all([call(), call()]);
      assert.deepEqual([a.ok, b.ok], [true, true], JSON.stringify([a, b]));
      assert.equal(a.ok && b.ok && a.titleId === b.titleId, true);
      assert.equal((await rowsFor(film.catalogId)).length, 1);
    }
  });
});
