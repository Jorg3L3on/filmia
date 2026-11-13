import "@/lib/test-support/local-db";

import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { asc, eq, inArray } from "drizzle-orm";
import { catalog, db, titles } from "@/db";
import { bingoCardOf } from "@/lib/juegos/bingo/core";
import { loadBingo, suggestForSquare } from "@/lib/juegos/bingo/store";
import { describeWithDb } from "@/lib/test-support/local-db";
import { seeder } from "@/lib/test-support/seed";

/** FIL-I55-2 · the bingo on the local database: dated films of the month only, same card, read-only. */
describeWithDb("Bingo del mes (FIL-I55-2)", () => {
  const seed = seeder("t-bingo");
  const now = new Date("2032-07-15T18:00:00Z"); // 2032-07-15 in Mexico City
  let ana = "";
  let beto = "";
  /** Fits nearly every square of any card: old, long, Japanese, every genre, an Oscar. */
  const superFilm = async (name: string) => {
    const film = await seed.film({
      name,
      year: 1975,
      runtime: 160,
      genres: ["Animación", "Terror", "Comedia", "Documental", "Ciencia ficción", "Romance", "Crimen", "Western"],
    });
    await db.update(catalog).set({ originalLanguage: "ja", awards: "Won 2 Oscars. 5 wins total." }).where(eq(catalog.id, film.catalogId));
    return film.catalogId;
  };

  before(async () => {
    ana = await seed.user("Ana Ruiz");
    beto = await seed.user("Beto");
  });

  after(async () => {
    await seed.cleanup();
  });

  it("a film without a date, or logged outside the month, ticks nothing", async () => {
    const undated = await superFilm("Sin fecha");
    const june = await superFilm("De junio");
    const august = await superFilm("De agosto");
    const undatedId = await seed.title(ana, undated, { watchedAt: new Date("2032-07-10T18:00:00Z") });
    await db.update(titles).set({ watchedUndated: true }).where(eq(titles.id, undatedId));
    await seed.title(ana, june, { watchedAt: new Date("2032-07-01T05:59:00Z") }); // 23:59 on June 30 in Mexico City
    await seed.title(ana, august, { watchedAt: new Date("2032-08-01T06:00:00Z") }); // 00:00 on August 1
    const view = await loadBingo(ana, now);
    assert.equal(view.mine.squares, 0);
    assert.ok(!view.table.some((row) => row.me), "nobody without a square on the table");

    const july = await superFilm("De julio");
    await seed.title(ana, july, { watchedAt: new Date("2032-07-01T06:00:00Z") }); // 00:00 on July 1
    const after = await loadBingo(ana, now);
    assert.equal(after.mine.squares, 1, "one dated film of the month ticks exactly one square");
    assert.equal(after.squares.find((square) => square.ticked)!.film!.name, "De julio");
  });

  it("the card is the same for two accounts in the same month (fixed date)", async () => {
    const forAna = (await loadBingo(ana, now)).squares.map((square) => square.id);
    const forBeto = (await loadBingo(beto, now)).squares.map((square) => square.id);
    assert.deepEqual(forAna, forBeto);
    assert.deepEqual(forAna, bingoCardOf("2032-07").map((square) => square.id));
  });

  it("opening the bingo changes no Title row", async () => {
    const snapshot = async () =>
      JSON.stringify(await db.select().from(titles).where(inArray(titles.userId, [ana, beto])).orderBy(asc(titles.id)));
    const beforeRows = await snapshot();
    await loadBingo(ana, now);
    await loadBingo(beto, now);
    await suggestForSquare(ana, bingoCardOf("2032-07")[0]!, now);
    assert.equal(await snapshot(), beforeRows);
  });

  it("the table shows first names, never emails", async () => {
    const view = await loadBingo(beto, now);
    const text = JSON.stringify(view.table);
    assert.ok(text.includes("Ana"));
    assert.ok(!text.includes("@"));
    assert.ok(!text.includes("Ruiz"));
  });
});
