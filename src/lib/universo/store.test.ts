import { describeWithDb } from "@/lib/test-support/local-db";
import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq } from "drizzle-orm";
import { catalog, db } from "@/db";
import { closeLocalPg } from "@/db/local-pg";
import { seeder } from "@/lib/test-support/seed";
import { bridgeAfterWatch, loadUniverso } from "./store";

const seed = seeder("universo");

const people = (list: Array<[number, string, string]>) => list.map(([id, name, role]) => ({ id, name, role }));

describeWithDb("Tu universo · store (FIL-I26-4)", () => {
  let userId = "";
  const films: Record<string, { catalogId: string; tmdbId: number }> = {};

  before(async () => {
    userId = await seed.user("Ivan");
    const specs: Record<string, Array<[number, string, string]>> = {
      lotr: [[1, "Peter Jackson", "director"], [2, "Andrew Lesnie", "dp"]],
      phm: [[4, "Phil Lord", "director"], [5, "Christopher Miller", "director"], [6, "Greig Fraser", "dp"]],
      michael: [[8, "Antoine Fuqua", "director"]],
      duna: [[9, "Denis Villeneuve", "director"], [6, "Greig Fraser", "dp"], [10, "Hans Zimmer", "composer"]],
      interestelar: [[11, "Christopher Nolan", "director"], [10, "Hans Zimmer", "composer"]],
    };
    for (const [key, list] of Object.entries(specs)) {
      const film = await seed.film({ name: key });
      await db.update(catalog).set({ tmdbPeople: people(list) }).where(eq(catalog.id, film.catalogId));
      films[key] = film;
    }
    for (const key of ["lotr", "phm", "michael"]) {
      await seed.title(userId, films[key]!.catalogId, { watchedAt: new Date(2026, 9, 1) });
    }
  });

  after(async () => {
    await seed.cleanup();
    await closeLocalPg();
  });

  it("day one: three islands, no bridge, Lord & Miller as one node", async () => {
    const { universo } = await loadUniverso(userId, "summary");
    assert.equal(universo.films, 3);
    assert.equal(universo.islands.length, 3);
    assert.equal(universo.bridges.length, 0);
    assert.ok(universo.islands.some((island) => island.nodes.some((node) => node.name === "Lord & Miller")));
  });

  it("Duna makes Fraser a bridge; then Interestelar makes Zimmer one, each revealed once", async () => {
    const duna = await seed.title(userId, films.duna!.catalogId, { watchedAt: new Date(2026, 9, 9) });
    const first = await bridgeAfterWatch(userId, duna);
    assert.equal(first?.personName, "Greig Fraser");
    assert.deepEqual(first?.films, ["duna", "phm"]);
    const interestelar = await seed.title(userId, films.interestelar!.catalogId, { watchedAt: new Date(2026, 9, 10) });
    const second = await bridgeAfterWatch(userId, films.interestelar!.catalogId);
    assert.equal(second?.personName, "Hans Zimmer");
    assert.equal(second?.line, "Hans Zimmer puso la música de las dos.");
    assert.equal(await bridgeAfterWatch(userId, interestelar), null, "once per person");
    const { universo } = await loadUniverso(userId, "summary");
    assert.deepEqual(universo.bridges.map((node) => node.name).sort(), ["Greig Fraser", "Hans Zimmer"]);
  });
});
