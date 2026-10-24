import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ThreadPerson } from "@/lib/rutas/core";
import { countdownsFor, daysLabel, daysUntil, premierePayload, type UniversePerson } from "./cine-cuenta";

const p = (id: number, name: string, role: ThreadPerson["role"]): ThreadPerson => ({ id, name, role });

const universe = new Map<number, UniversePerson>([
  [1, { id: 1, name: "Denis Villeneuve", role: "director", films: ["Duna"] }],
  [2, { id: 2, name: "Ryan Gosling", role: "cast", films: ["Proyecto Fin del Mundo"] }],
  [3, { id: 3, name: "Timothée Chalamet", role: "cast", films: ["Duna"] }],
]);

const release = (catalogId: string, name: string, day: string, people: ThreadPerson[]) => ({
  catalogId,
  tmdbId: catalogId.length,
  name,
  posterPath: null,
  mxReleaseDate: day,
  people,
});

describe("cuenta regresiva", () => {
  it("only premieres with someone of yours, the nearest first, crew before cast", () => {
    const list = countdownsFor(
      [
        release("starfighter", "Starfighter", "2027-05-26", [p(2, "Ryan Gosling", "cast")]),
        release("duna3", "Duna: Parte tres", "2026-12-17", [p(3, "Timothée Chalamet", "cast"), p(1, "Denis Villeneuve", "director")]),
        release("nadie", "Sin nadie tuyo", "2026-11-01", [p(99, "X", "director")]),
        release("pasada", "Ya pasó", "2026-10-01", [p(1, "Denis Villeneuve", "director")]),
      ],
      universe,
      "2026-10-23",
    );
    assert.deepEqual(list.map((item) => item.release.name), ["Duna: Parte tres", "Starfighter"]);
    assert.equal(list[0]!.person.name, "Denis Villeneuve");
    assert.equal(list[0]!.days, 55);
    assert.equal(list[0]!.reason, "Denis Villeneuve, que dirigió Duna");
    assert.equal(list[1]!.reason, "Ryan Gosling, que sale en Proyecto Fin del Mundo");
  });

  it("nobody of yours: no countdown at all", () => {
    assert.deepEqual(countdownsFor([release("x", "X", "2026-12-01", [p(50, "Y", "director")])], universe, "2026-10-23"), []);
  });

  it("counts days in Mexico City calendar days and says them plainly", () => {
    assert.equal(daysUntil("2026-10-24", "2026-10-23"), 1);
    assert.equal(daysLabel(0), "Hoy");
    assert.equal(daysLabel(1), "Mañana");
    assert.equal(daysLabel(55), "Faltan 55 días");
    assert.deepEqual(premierePayload({ catalogId: "d3", name: "Duna: Parte tres" }, "Denis Villeneuve, que dirigió Duna"), {
      title: "Hoy se estrena",
      body: "«Duna: Parte tres». Denis Villeneuve, que dirigió Duna.",
      url: "/cine",
      tag: "estreno-d3",
    });
  });
});
