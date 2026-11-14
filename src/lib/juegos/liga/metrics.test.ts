import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ligaLaunchWeek, ligaMetrics } from "@/lib/juegos/liga/metrics";

describe("La liga · metrics (FIL-I55-4)", () => {
  it("distinct people and partidas per person, per Mexico City week, before and after the launch", () => {
    const rows = [
      { userId: "ana", startedAt: new Date("2027-01-05T18:00:00Z") },
      { userId: "ana", startedAt: new Date("2027-01-06T18:00:00Z") },
      { userId: "beto", startedAt: new Date("2027-01-07T18:00:00Z") },
      { userId: "ana", startedAt: new Date("2027-01-11T05:59:00Z") }, // Sunday 23:59: still the week of 4 Jan
      { userId: "caro", startedAt: new Date("2027-01-11T06:01:00Z") }, // Monday 00:01: launch week
    ];
    assert.deepEqual(ligaMetrics(rows, ["2027-01-04", "2027-01-11", "2027-01-18"], "2027-01-11"), [
      { week: "2027-01-04", players: 2, partidas: 4, perPerson: 2, phase: "antes" },
      { week: "2027-01-11", players: 1, partidas: 1, perPerson: 1, phase: "después" },
      { week: "2027-01-18", players: 0, partidas: 0, perPerson: null, phase: "después" },
    ]);
  });

  it("the launch week comes from the cartel", () => {
    assert.equal(ligaLaunchWeek(), "2027-01-11");
  });
});
