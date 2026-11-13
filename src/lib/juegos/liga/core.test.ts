import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dailyPoints,
  daysLeftInWeek,
  eventWeek,
  LIGA_POINTS,
  ligaDetail,
  rankLiga,
  tallyLiga,
  weekLabel,
  weekRange,
  type LigaEvent,
} from "@/lib/juegos/liga/core";

describe("La liga · rules (FIL-I55-3)", () => {
  it("the rules table", () => {
    assert.deepEqual(LIGA_POINTS, { diaria: 100, dueloGanado: 60, dueloPerdido: 20, dueloEmpate: 40, bingoLinea: 80 });
  });

  it("a fixed week adds up exactly as the rules say", () => {
    const at = new Date("2033-12-28T18:00:00Z");
    const events: LigaEvent[] = [
      // Mayor o menor declares 10: 7 of 10 → 70; 10 of 10 → 100.
      { userId: "ana", kind: "diaria", at, juego: "mayor", score: 7, dayBest: 9 },
      { userId: "ana", kind: "diaria", at, juego: "mayor", score: 10, dayBest: 10 },
      // A daily with no declared total is scored against the day's best: 3 of a best 6 → 50.
      { userId: "ana", kind: "diaria", at, juego: "otra-diaria", score: 3, dayBest: 6 },
      { userId: "ana", kind: "duelo", at, outcome: "ganado" },
      { userId: "ana", kind: "duelo", at, outcome: "perdido" },
      { userId: "ana", kind: "duelo", at, outcome: "empate" },
      { userId: "ana", kind: "bingo", week: "2033-12-26", lines: 2 },
      { userId: "beto", kind: "duelo", at, outcome: "perdido" },
      { userId: "caro", kind: "bingo", week: "2033-12-26", lines: 0 },
    ];
    const rows = tallyLiga(events);
    const ana = rows.find((row) => row.userId === "ana")!;
    assert.equal(ana.points, 70 + 100 + 50 + 60 + 20 + 40 + 160);
    assert.deepEqual({ partidas: ana.partidas, duelos: ana.duelos, ganados: ana.duelosGanados, lineas: ana.bingoLineas }, { partidas: 3, duelos: 3, ganados: 1, lineas: 2 });
    assert.equal(rows.find((row) => row.userId === "beto")!.points, 20);
    assert.equal(rows.find((row) => row.userId === "caro"), undefined, "nothing played, not on the table");
    assert.equal(ligaDetail(ana), "3 diarias · 1 duelo ganado · 2 líneas de bingo");
  });

  it("a daily never gives more than 100 nor less than 0", () => {
    assert.equal(dailyPoints({ juego: "mayor", score: 12, dayBest: 12 }), 100);
    assert.equal(dailyPoints({ juego: "x", score: 0, dayBest: 0 }), 0);
    assert.equal(dailyPoints({ juego: "x", score: 4, dayBest: 4 }), 100);
  });

  it("Sunday 23:59 and Monday 00:01 in Mexico City are different weeks", () => {
    const sunday = new Date("2034-01-02T05:59:00Z"); // Sunday 1 Jan 2034, 23:59 (UTC−6)
    const monday = new Date("2034-01-02T06:01:00Z"); // Monday 2 Jan 2034, 00:01
    const base = { userId: "ana", kind: "duelo", outcome: "ganado" } as const;
    assert.equal(eventWeek({ ...base, at: sunday }), "2033-12-26");
    assert.equal(eventWeek({ ...base, at: monday }), "2034-01-02");
    const range = weekRange("2033-12-26");
    assert.ok(sunday < range.to && monday >= range.to);
  });

  it("ranking shares places on equal points", () => {
    const ranked = rankLiga([
      { name: "Beto", points: 80 },
      { name: "Ana", points: 120 },
      { name: "Caro", points: 80 },
    ]);
    assert.deepEqual(ranked.map((row) => [row.name, row.place]), [["Ana", 1], ["Beto", 2], ["Caro", 2]]);
  });

  it("labels", () => {
    assert.equal(weekLabel("2026-11-09"), "Del 9 al 15 nov");
    assert.equal(weekLabel("2026-11-30"), "Del 30 nov al 6 dic");
    assert.equal(daysLeftInWeek(new Date("2026-11-13T18:00:00Z")), 3); // Friday
    assert.equal(daysLeftInWeek(new Date("2026-11-16T05:00:00Z")), 1); // Sunday 23:00
  });
});

describe("La liga · detail line (FIL-I55-3)", () => {
  it("names duels played when none was won", () => {
    assert.equal(ligaDetail({ partidas: 0, duelos: 2, duelosGanados: 0, bingoLineas: 0 }), "2 duelos jugados");
    assert.equal(ligaDetail({ partidas: 1, duelos: 1, duelosGanados: 1, bingoLineas: 1 }), "1 diaria · 1 duelo ganado · 1 línea de bingo");
  });
});
