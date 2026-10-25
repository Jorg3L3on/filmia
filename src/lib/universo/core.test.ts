import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ThreadPerson } from "@/lib/rutas/core";
import {
  buildUniverso,
  closestIsland,
  isBridge,
  mostBridges,
  newBridge,
  universoLine,
  type UniversoFilm,
} from "./core";

const p = (id: number, name: string, role: ThreadPerson["role"]): ThreadPerson => ({ id, name, role });

const JACKSON = p(1, "Peter Jackson", "director");
const LESNIE = p(2, "Andrew Lesnie", "dp");
const SHORE = p(3, "Howard Shore", "composer");
const LORD = p(4, "Phil Lord", "director");
const MILLER = p(5, "Christopher Miller", "director");
const FRASER = p(6, "Greig Fraser", "dp");
const GOSLING = p(7, "Ryan Gosling", "cast");
const FUQUA = p(8, "Antoine Fuqua", "director");
const VILLENEUVE = p(9, "Denis Villeneuve", "director");
const ZIMMER = p(10, "Hans Zimmer", "composer");
const NOLAN = p(11, "Christopher Nolan", "director");
const CHALAMET = p(12, "Timothée Chalamet", "cast");

let day = 0;
const film = (catalogId: string, name: string, people: ThreadPerson[]): UniversoFilm => ({
  catalogId,
  tmdbId: catalogId.length,
  name,
  year: 2000,
  posterPath: null,
  watchedAt: new Date(Date.UTC(2026, 9, 1 + day++)),
  people,
});

const LOTR = film("lotr", "La comunidad del anillo", [JACKSON, LESNIE, SHORE]);
const PHM = film("phm", "Proyecto Fin del Mundo", [LORD, MILLER, FRASER, GOSLING]);
const MICHAEL = film("michael", "Michael", [FUQUA]);

describe("Tu universo · el caso Ivan", () => {
  it("day one: three films, three islands, no bridge", () => {
    const universo = buildUniverso([LOTR, PHM, MICHAEL]);
    assert.equal(universo.islands.length, 3);
    assert.equal(universo.bridges.length, 0);
    assert.equal(universoLine(universo), "3 películas · 3 islas · ningún puente");
  });

  it("Lord & Miller are one node: same films, both directors", () => {
    const universo = buildUniverso([LOTR, PHM, MICHAEL]);
    const names = universo.islands.flatMap((island) => island.nodes.map((node) => node.name));
    assert.ok(names.includes("Lord & Miller"));
    assert.ok(!names.includes("Phil Lord"));
  });

  it("closes the smallest island: Lord & Miller 1 de 5", () => {
    const totals = new Map([
      [JACKSON.id, 15],
      [LORD.id, 5],
      [FUQUA.id, 17],
    ]);
    const universo = buildUniverso([LOTR, PHM, MICHAEL], totals);
    const closest = closestIsland(universo.islands.flatMap((island) => island.nodes));
    assert.equal(closest?.node.name, "Lord & Miller");
    assert.equal(closest?.node.count, 1);
    assert.equal(closest?.node.total, 5);
    assert.equal(closest?.left, 4);
  });

  it("a director across his own films is the island, not a bridge", () => {
    const towers = film("towers", "Las dos torres", [JACKSON, LESNIE, SHORE]);
    assert.equal(isBridge([LOTR, towers]), false);
    const universo = buildUniverso([LOTR, towers]);
    assert.equal(universo.islands.length, 1);
    assert.equal(universo.bridges.length, 0);
  });

  it("Zimmer joins Duna and Interestelar: the first bridge, revealed once", () => {
    const duna = film("duna", "Duna", [VILLENEUVE, FRASER, ZIMMER, CHALAMET]);
    const interestelar = film("interestelar", "Interestelar", [NOLAN, ZIMMER]);
    const universo = buildUniverso([LOTR, PHM, MICHAEL, duna, interestelar]);
    assert.deepEqual(
      universo.bridges.map((node) => node.name).sort(),
      ["Greig Fraser", "Hans Zimmer"],
    );
    // PHM, Duna and Interestelar are one island now (Fraser, then Zimmer).
    assert.equal(universo.islands.length, 3);
    const reveal = newBridge(interestelar, [LOTR, PHM, MICHAEL, duna], new Set());
    assert.equal(reveal?.person.name, "Hans Zimmer");
    assert.deepEqual(reveal?.with.map((item) => item.name), ["Duna"]);
    assert.equal(newBridge(interestelar, [LOTR, PHM, MICHAEL, duna], new Set([ZIMMER.id])), null, "once per person");
  });

  it("draws at most the cap, every island keeps a share", () => {
    const crowd = Array.from({ length: 40 }, (_, index) => p(100 + index, `Actor ${index}`, "cast"));
    const big = film("big", "Grande", crowd);
    const universo = buildUniverso([big, MICHAEL], new Map(), 12);
    const drawn = universo.islands.reduce((sum, island) => sum + island.nodes.length, 0);
    assert.ok(drawn <= 12);
    assert.ok(universo.islands.every((island) => island.nodes.length > 0));
    assert.equal(universo.hidden, universo.people - drawn);
  });
});

describe("la que más puentes abre", () => {
  it("Greig Fraser: Duna (Villeneuve, Zimmer, Chalamet come back), the earlier on a tie", () => {
    const candidates = [
      { tmdbId: 1, name: "Star Wars: Rogue One", releaseDate: "2016-12-14", people: [p(20, "Gareth Edwards", "director"), FRASER] },
      { tmdbId: 2, name: "Duna", releaseDate: "2021-09-15", people: [VILLENEUVE, FRASER, ZIMMER, CHALAMET] },
      { tmdbId: 3, name: "Batman", releaseDate: "2022-03-01", people: [p(21, "Matt Reeves", "director"), FRASER] },
      { tmdbId: 4, name: "Duna: Parte dos", releaseDate: "2024-02-27", people: [VILLENEUVE, FRASER, ZIMMER, CHALAMET] },
    ];
    const best = mostBridges(candidates, [FRASER.id], new Set([GOSLING.id, LORD.id]));
    assert.equal(best?.film.name, "Duna");
    assert.deepEqual(best?.people, ["Denis Villeneuve", "Hans Zimmer", "Timothée Chalamet"]);
  });

  it("nothing shared: no answer", () => {
    const candidates = [{ tmdbId: 1, name: "Sola", releaseDate: null, people: [p(30, "X", "director")] }];
    assert.equal(mostBridges(candidates, [FRASER.id], new Set()), null);
  });
});
