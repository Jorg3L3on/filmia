import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOscarCeremony } from "@/lib/juegos/oscar/ceremonies";
import {
  ballotRows,
  formatOscarClose,
  oscarNightSummary,
  startCategoryIndex,
  toBallotCategories,
  votedCount,
} from "@/lib/juegos/oscar/view";

const categories = toBallotCategories(getOscarCeremony(2024)!);

describe("quiniela/view (FIL-I51-2)", () => {
  it("draws people with their film and songs in quotes", () => {
    const actress = categories.find((category) => category.id === "actriz")!;
    assert.deepEqual(
      actress.nominees.map((nominee) => nominee.name).slice(0, 2),
      ["Annette Bening", "Lily Gladstone"],
    );
    assert.equal(actress.nominees[0]!.detail, "Nyad");
    const song = categories.find((category) => category.id === "cancion")!;
    assert.ok(song.nominees.every((nominee) => nominee.name.startsWith("«")));
  });

  it("opens on the asked category, else the first without a vote", () => {
    assert.equal(startCategoryIndex(categories, {}), 0);
    assert.equal(startCategoryIndex(categories, { pelicula: "x", direccion: "y" }), 2);
    assert.equal(startCategoryIndex(categories, { pelicula: "x" }, "cancion"), categories.findIndex((c) => c.id === "cancion"));
    assert.equal(startCategoryIndex(categories, {}, "inventada"), 0);
    const all = Object.fromEntries(categories.map((category) => [category.id, "x"]));
    assert.equal(startCategoryIndex(categories, all), 0);
  });

  it("counts votes and lists the ballot with its picks", () => {
    const votes = { pelicula: "tt15398776", actor: "nm0614165", nada: "x" };
    assert.equal(votedCount(categories, votes), 2);
    const rows = ballotRows(categories, votes);
    assert.equal(rows.length, 23);
    assert.equal(rows[0]!.pick?.name, "Oppenheimer");
    assert.equal(rows[1]!.pick, null);
  });

  it("writes the close in Mexico City time", () => {
    assert.match(formatOscarClose(new Date("2024-03-10T23:00:00Z")), /domingo, 10 de marzo.*5:00/);
  });
});

describe("quiniela/la noche (FIL-I51-4)", () => {
  const at = (minute: number) => new Date(Date.UTC(2024, 2, 11, 1, minute));
  const votes = { pelicula: "tt15398776", actriz: "nm4291409", actor: "nm0614165" };

  it("before any winner: everything pending, the first category is next", () => {
    const night = oscarNightSummary(categories, votes, {});
    assert.deepEqual([night.hits, night.announced, night.remaining, night.finished], [0, 0, 23, false]);
    assert.equal(night.next?.category.id, "pelicula");
    assert.equal(night.next?.pick?.name, "Oppenheimer");
    assert.ok(night.marks.every((mark) => mark === "p"));
  });

  it("mid-night: newest announcements first, hits and misses, the next still open", () => {
    const night = oscarNightSummary(categories, votes, {
      actriz: { nomineeId: "nm1297015", announcedAt: at(10) },
      actor: { nomineeId: "nm0614165", announcedAt: at(30) },
    });
    assert.deepEqual([night.hits, night.announced, night.remaining], [1, 2, 21]);
    assert.deepEqual(
      night.latest.map((entry) => [entry.category.id, entry.winner?.name, entry.pick?.name, entry.hit]),
      [
        ["actor", "Cillian Murphy", "Cillian Murphy", true],
        ["actriz", "Emma Stone", "Lily Gladstone", false],
      ],
    );
    assert.equal(night.next?.category.id, "pelicula");
    assert.deepEqual(night.marks.slice(0, 4), ["p", "p", "n", "y"]);
  });

  it("every winner in: finished, no next", () => {
    const winners = Object.fromEntries(
      categories.map((category, index) => [category.id, { nomineeId: category.nominees[0]!.id, announcedAt: at(index) }]),
    );
    const night = oscarNightSummary(categories, {}, winners);
    assert.deepEqual([night.finished, night.remaining, night.hits, night.next], [true, 0, 0, null]);
    assert.equal(night.latest[0]?.pick, null);
  });
});
