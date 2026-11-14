import "@/lib/test-support/local-db";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { catalog, cinemaReleases, db, juegoEstrenos, titles } from "@/db";
import { GET as juegosCron } from "@/app/api/cron/juegos/route";
import { EstrenoClosedError, ensureEstrenos, loadEstrenos, resolveEstrenos, savePronostico } from "@/lib/juegos/estrenos/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I55-1 · the Quiniela de estrenos on the local database, with fixed dates. */
describeWithDb("Quiniela de estrenos (FIL-I55-1)", () => {
  const seed = seeder("t-estrenos");
  // A month no other suite uses: picks are made among every release of the month.
  const before1 = new Date("2033-03-02T18:00:00Z"); // 2033-03-02 in Mexico City
  const films: string[] = [];
  let ana = "";
  let beto = "";
  let caro = "";
  const previousSecret = process.env.CRON_SECRET;

  before(async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    ana = await seed.user("Ana Ruiz");
    beto = await seed.user("Beto");
    caro = await seed.user("Carolina");
    const dates = ["2033-03-10", "2033-03-17", "2033-03-24", "2033-03-31"];
    for (const [index, day] of dates.entries()) {
      const film = await seed.film({ name: `Estreno ${index + 1}`, year: 2033 });
      films.push(film.catalogId);
      await db.insert(cinemaReleases).values({ catalogId: film.catalogId, mxReleaseDate: day, status: "upcoming", popularity: 100 - index * 10 });
    }
  });

  after(async () => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    await seed.cleanup();
  });

  const mine = async (userId: string, now: Date) => (await loadEstrenos(userId, now)).filter((card) => films.includes(card.catalogId));

  it("picks the month's three most popular releases, the same for everyone", async () => {
    await ensureEstrenos(before1);
    await ensureEstrenos(before1);
    const picked = await db.select().from(juegoEstrenos).where(inArray(juegoEstrenos.catalogId, films));
    assert.deepEqual(picked.map((row) => row.catalogId).sort(), films.slice(0, 3).sort());
    const forAna = (await mine(ana, before1)).map((card) => card.catalogId);
    const forBeto = (await mine(beto, before1)).map((card) => card.catalogId);
    assert.deepEqual(forAna, forBeto);
  });

  it("others' forecasts never reach the client before saving one's own", async () => {
    const film = films[0]!;
    await savePronostico({ userId: ana, catalogId: film, guess: 74, now: before1 });
    const betoBefore = (await mine(beto, before1)).find((card) => card.catalogId === film)!;
    assert.equal(betoBefore.revealed, false);
    assert.deepEqual(betoBefore.others, []);
    assert.equal(betoBefore.votes, 1);
    const payload = JSON.stringify(betoBefore);
    assert.ok(!payload.includes(ana), "Ana's id is not in Beto's card");
    assert.ok(!payload.includes("Ana"), "Ana's name is not in Beto's card");
    assert.ok(!payload.includes('"guess"'), "no guess of anyone is in Beto's card");

    await savePronostico({ userId: beto, catalogId: film, guess: 81, now: before1 });
    const betoAfter = (await mine(beto, before1)).find((card) => card.catalogId === film)!;
    assert.equal(betoAfter.revealed, true);
    assert.deepEqual(
      betoAfter.others.map((other) => [other.name, other.guess]),
      [["Ana", 74]],
    );
    assert.ok(!JSON.stringify(betoAfter).includes("@"), "never an email");
  });

  it("a forecast can be changed until the day before and not from the release day on", async () => {
    const film = films[0]!; // releases 2033-03-10
    await savePronostico({ userId: ana, catalogId: film, guess: 70, now: new Date("2033-03-10T05:59:00Z") }); // 23:59 on the 9th
    await assert.rejects(
      savePronostico({ userId: ana, catalogId: film, guess: 72, now: new Date("2033-03-10T06:00:00Z") }), // 00:00 on the 10th
      EstrenoClosedError,
    );
    await assert.rejects(savePronostico({ userId: caro, catalogId: film, guess: 72, now: new Date("2033-03-12T18:00:00Z") }), EstrenoClosedError);
    const card = (await mine(ana, new Date("2033-03-12T18:00:00Z"))).find((item) => item.catalogId === film)!;
    assert.equal(card.mine, 70);
    assert.equal(card.phase, "cerrada");
  });

  it("resolution: without a rating at 14 days it waits and retries; then the closest win, ties included", async () => {
    const film = films[0]!; // resolves 2033-03-24
    await savePronostico({ userId: caro, catalogId: film, guess: 72, now: before1 });
    const due = new Date("2033-03-24T18:00:00Z");

    const early = await resolveEstrenos(new Date("2033-03-23T18:00:00Z"));
    assert.equal((await db.query.juegoEstrenos.findFirst({ where: eq(juegoEstrenos.catalogId, film) }))!.actual, null);
    assert.ok(early.resolved >= 0);

    await db.update(catalog).set({ imdbRating: null }).where(eq(catalog.id, film));
    const waiting = await resolveEstrenos(due);
    assert.ok(waiting.waiting >= 1);
    assert.equal((await db.query.juegoEstrenos.findFirst({ where: eq(juegoEstrenos.catalogId, film) }))!.actual, null);
    assert.equal((await mine(ana, due)).find((card) => card.catalogId === film)!.phase, "pendiente");

    await db.update(catalog).set({ imdbRating: 7.1 }).where(eq(catalog.id, film));
    await resolveEstrenos(new Date("2033-03-25T18:00:00Z"));
    const resolved = (await mine(ana, new Date("2033-03-25T18:00:00Z"))).find((card) => card.catalogId === film)!;
    assert.equal(resolved.actual, 71);
    assert.equal(resolved.phase, "resuelta");
    // Ana 7.0 and Caro 7.2 are both 0.1 away: a tie; Beto's 8.1 loses.
    assert.equal(resolved.iWon, true);
    assert.deepEqual([...resolved.winners].sort(), ["Carolina", "Tú"]);
    assert.deepEqual(resolved.others.filter((other) => other.winner).map((other) => other.name), ["Carolina"]);
  });

  it("the Extras cron resolves what is due and leaves what has no rating pending", async () => {
    const pending = await seed.film({ name: "Sin nota", year: 2020 });
    const rated = await seed.film({ name: "Con nota", year: 2020 });
    await db.insert(juegoEstrenos).values([
      { catalogId: pending.catalogId, month: "2020-01", releaseDate: "2020-01-10", resolveOn: "2020-01-24" },
      { catalogId: rated.catalogId, month: "2020-01", releaseDate: "2020-01-10", resolveOn: "2020-01-24" },
    ]);
    await db.update(catalog).set({ imdbRating: 6.66 }).where(eq(catalog.id, rated.catalogId));
    const call = () => juegosCron(new Request("http://localhost/api/cron/juegos", { headers: { authorization: "Bearer test-cron-secret" } }));

    const first = await call();
    assert.equal(first.status, 200);
    const body = (await first.json()) as { estrenos: { resolved: number; waiting: number } };
    assert.ok(body.estrenos.waiting >= 1);
    const rows = await db.select().from(juegoEstrenos).where(inArray(juegoEstrenos.catalogId, [pending.catalogId, rated.catalogId]));
    assert.equal(rows.find((row) => row.catalogId === rated.catalogId)!.actual, 67);
    assert.equal(rows.find((row) => row.catalogId === pending.catalogId)!.actual, null);

    await db.update(catalog).set({ imdbRating: 5.0 }).where(eq(catalog.id, pending.catalogId));
    await call();
    const retried = await db.query.juegoEstrenos.findFirst({ where: eq(juegoEstrenos.catalogId, pending.catalogId) });
    assert.equal(retried!.actual, 50);
  });

  it("never writes to Title", async () => {
    const rows = await db.select().from(titles).where(inArray(titles.userId, [ana, beto, caro]));
    assert.equal(rows.length, 0);
  });
});
