import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, savedViews } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { MAX_SAVED_VIEWS } from "@/lib/watchlist-views";
import { createSavedView, deleteSavedView, loadSavedViews, pinSavedView, updateSavedViewQuery } from "./saved-views-store";

const seed = seeder("vistas");

describeWithDb("Vistas guardadas · store (FIL-I34-6)", () => {
  let userId = "";
  let stranger = "";

  before(async () => {
    userId = await seed.user("Vistas");
    stranger = await seed.user("Otra");
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("saves a normalized query, rejects empty ones, blank or repeated names", async () => {
    const saved = await createSavedView(userId, { name: "  Clásicos ", query: "year=-1989&sort=year&dir=asc&seed=9&junk=1", pin: true });
    assert.equal(saved.ok, true);
    assert.ok(saved.ok);
    assert.deepEqual(
      saved.views.map(({ name, query, pinned }) => ({ name, query, pinned })),
      [{ name: "Clásicos", query: "sort=year&dir=asc&year=-1989", pinned: true }],
    );
    assert.deepEqual(await createSavedView(userId, { name: "Todo", query: "" }), { ok: false, error: "Elige un filtro o un orden antes de guardar." });
    assert.deepEqual(await createSavedView(userId, { name: "  ", query: "short=1" }), { ok: false, error: "Ponle un nombre a la vista." });
    assert.deepEqual(await createSavedView(userId, { name: "clásicos", query: "short=1" }), { ok: false, error: "Ya tienes una vista con ese nombre." });
  });

  it("one pinned view at most, listed first", async () => {
    const second = await createSavedView(userId, { name: "Cortas en mis plataformas", query: "minePlatforms=1&short=1", pin: true });
    assert.ok(second.ok && second.id);
    assert.deepEqual(
      second.views.map((view) => [view.name, view.pinned]),
      [
        ["Cortas en mis plataformas", true],
        ["Clásicos", false],
      ],
    );
    const unpinned = await pinSavedView(userId, second.id, false);
    assert.ok(unpinned.ok);
    assert.equal(unpinned.views.filter((view) => view.pinned).length, 0);
    const clasicos = unpinned.views.find((view) => view.name === "Clásicos")!;
    const repinned = await pinSavedView(userId, clasicos.id, true);
    assert.ok(repinned.ok);
    assert.deepEqual(repinned.views.filter((view) => view.pinned).map((view) => view.name), ["Clásicos"]);
  });

  it("the database refuses a second pinned row even if two writes race", async () => {
    const [pinned] = await db.select().from(savedViews).where(eq(savedViews.userId, userId));
    await assert.rejects(
      db.insert(savedViews).values({ id: `${userId}-dup`, userId, name: "Dup", query: "short=1", pinned: true }),
    );
    assert.ok(pinned);
  });

  it("«Actualizar vista» rewrites the query; nobody touches someone else's views", async () => {
    const [clasicos] = (await loadSavedViews(userId)).filter((view) => view.name === "Clásicos");
    assert.ok(clasicos);
    const updated = await updateSavedViewQuery(userId, clasicos.id, "year=-1989&sort=year&dir=asc&imdb=7");
    assert.ok(updated.ok);
    assert.equal(updated.views.find((view) => view.id === clasicos.id)?.query, "sort=year&dir=asc&year=-1989&imdb=7");

    assert.deepEqual(await updateSavedViewQuery(stranger, clasicos.id, "short=1"), { ok: false, error: "Esa vista ya no existe." });
    assert.deepEqual(await pinSavedView(stranger, clasicos.id, false), { ok: false, error: "Esa vista ya no existe." });
    await deleteSavedView(stranger, clasicos.id);
    assert.equal((await loadSavedViews(userId)).length, 2);
    assert.deepEqual(await loadSavedViews(stranger), []);
  });

  it("caps the list and deletes", async () => {
    for (let index = (await loadSavedViews(userId)).length; index < MAX_SAVED_VIEWS; index += 1) {
      assert.equal((await createSavedView(userId, { name: `Vista ${index}`, query: `imdb=${6 + (index % 3)}&genre=${index + 1}` })).ok, true);
    }
    const over = await createSavedView(userId, { name: "Una más", query: "short=1" });
    assert.deepEqual(over, { ok: false, error: `Puedes guardar hasta ${MAX_SAVED_VIEWS} vistas. Borra una para seguir.` });
    const [first] = await loadSavedViews(userId);
    const after = await deleteSavedView(userId, first!.id);
    assert.ok(after.ok);
    assert.equal(after.views.length, MAX_SAVED_VIEWS - 1);
  });
});
