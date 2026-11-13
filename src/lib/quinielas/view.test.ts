import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { skeletonCeremony, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";
import { ceremonyInfo, hubEntries } from "@/lib/quinielas/hub-core";
import {
  ballotRows,
  formatClose,
  nightSummary,
  startCategoryIndex,
  toBallotCategories,
  votedCount,
} from "@/lib/quinielas/view";

const categories = toBallotCategories(getCeremony("oscar-2024")!);

describe("quinielas/view (FIL-I51-2)", () => {
  it("draws people with their film and songs in quotes", () => {
    const actress = categories.find((category) => category.id === "actriz")!;
    assert.deepEqual(actress.nominees.map((nominee) => nominee.name).slice(0, 2), ["Annette Bening", "Lily Gladstone"]);
    assert.equal(actress.nominees[0]!.detail, "Nyad");
    assert.ok(categories.find((category) => category.id === "cancion")!.nominees.every((nominee) => nominee.name.startsWith("«")));
  });

  it("opens on the asked category, else the first without a vote", () => {
    assert.equal(startCategoryIndex(categories, {}), 0);
    assert.equal(startCategoryIndex(categories, { pelicula: "x", direccion: "y" }), 2);
    assert.equal(startCategoryIndex(categories, { pelicula: "x" }, "cancion"), categories.findIndex((c) => c.id === "cancion"));
    assert.equal(startCategoryIndex(categories, {}, "inventada"), 0);
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
    assert.match(formatClose(new Date("2024-03-10T23:00:00Z")), /domingo, 10 de marzo.*5:00/);
  });
});

describe("quinielas/la noche (FIL-I51-4)", () => {
  const at = (minute: number) => new Date(Date.UTC(2024, 2, 11, 1, minute));
  const votes = { pelicula: "tt15398776", actriz: "nm4291409", actor: "nm0614165" };

  it("before any winner: everything pending, the first category is next", () => {
    const night = nightSummary(categories, votes, {});
    assert.deepEqual([night.hits, night.announced, night.remaining, night.finished], [0, 0, 23, false]);
    assert.equal(night.next?.category.id, "pelicula");
    assert.equal(night.next?.pick?.name, "Oppenheimer");
  });

  it("mid-night: newest announcements first, hits and misses, the next still open", () => {
    const night = nightSummary(categories, votes, {
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
    assert.deepEqual(night.marks.slice(0, 4), ["p", "p", "n", "y"]);
  });

  it("every winner in: finished, no next", () => {
    const winners = Object.fromEntries(
      categories.map((category, index) => [category.id, { nomineeId: category.nominees[0]!.id, announcedAt: at(index) }]),
    );
    const night = nightSummary(categories, {}, winners);
    assert.deepEqual([night.finished, night.remaining, night.hits, night.next], [true, 0, 0, null]);
  });
});

describe("quinielas/hub (FIL-I51-8)", () => {
  // The 2027 season as planned: Globos (Dec–Jan), BAFTA and Óscar overlapping (Jan–Mar), Emmy (Jul–Sep).
  const ceremony = (award: "globos" | "bafta" | "oscar" | "emmy", nominationsOn: string, ceremonyOn: string) =>
    skeletonCeremony({ award, year: 2027, nominationsOn, ceremonyOn, builtAt: "x" });
  const season: QuinielaCeremonyFile[] = [
    ceremony("globos", "2026-12-07", "2027-01-10"),
    ceremony("bafta", "2027-01-19", "2027-02-21"),
    ceremony("oscar", "2027-01-21", "2027-03-14"),
    ceremony("emmy", "2027-07-14", "2027-09-19"),
  ];
  const hub = (today: string, extra: Partial<Parameters<typeof hubEntries>[1]> = {}) =>
    hubEntries(season, {
      today,
      now: new Date(`${today}T18:00:00Z`),
      closingTimes: {},
      voteCounts: {},
      winnerCounts: {},
      ...extra,
    }).map((entry) => `${entry.info.id}:${entry.state}`);

  it("before any nominations every ceremony is «próxima»", () => {
    assert.deepEqual(hub("2026-11-20"), ["globos-2027:proxima", "bafta-2027:proxima", "oscar-2027:proxima", "emmy-2027:proxima"]);
  });

  it("BAFTA and Óscar open at once, open first, the Globos gone a week after their night", () => {
    const closingTimes = {
      "globos-2027": new Date("2027-01-11T01:00:00Z"),
      "bafta-2027": new Date("2027-02-21T19:00:00Z"),
      "oscar-2027": new Date("2027-03-14T23:00:00Z"),
    };
    assert.deepEqual(hub("2027-02-01", { closingTimes }), ["bafta-2027:abierta", "oscar-2027:abierta", "emmy-2027:proxima"]);
    // The night of the BAFTA: live first, then the Óscar still open.
    assert.deepEqual(hub("2027-02-21", { closingTimes, now: new Date("2027-02-21T20:00:00Z"), winnerCounts: { "bafta-2027": 3 } }), [
      "bafta-2027:en-vivo",
      "oscar-2027:abierta",
      "emmy-2027:proxima",
    ]);
  });

  it("nominations out but ballots not opened: «pronto»; every winner in: «resultado»", () => {
    assert.deepEqual(hub("2027-01-20").slice(0, 1), ["bafta-2027:pronto"]);
    const total = season[1]!.categories.length;
    assert.deepEqual(
      hub("2027-02-22", { closingTimes: { "bafta-2027": new Date("2027-02-21T19:00:00Z") }, winnerCounts: { "bafta-2027": total } }).at(-1),
      "bafta-2027:resultado",
    );
  });

  it("names each ceremony with its award", () => {
    assert.deepEqual(
      season.map((file) => [ceremonyInfo(file).title, ceremonyInfo(file).night]),
      [
        ["Quiniela de los Globos de Oro 2027", "La noche de los Globos de Oro"],
        ["Quiniela de los BAFTA 2027", "La noche de los BAFTA"],
        ["Quiniela del Óscar 2027", "La noche del Óscar"],
        ["Quiniela de los Emmy 2027", "La noche de los Emmy"],
      ],
    );
  });
});
