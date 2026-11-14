import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  closestOf,
  daysUntil,
  estrenoChip,
  estrenoPhase,
  ESTRENOS_PER_MONTH,
  isForecastOpen,
  mayRevealOthers,
  monthBounds,
  parseGuess,
  pickEstrenos,
  previousMonth,
  ratingToTenths,
  resolveOnOf,
} from "@/lib/juegos/estrenos/core";

describe("Quiniela de estrenos · rules (FIL-I55-1)", () => {
  it("a forecast closes on the release day, not before (fixed dates)", () => {
    assert.equal(isForecastOpen("2026-12-18", "2026-12-17"), true);
    assert.equal(isForecastOpen("2026-12-18", "2026-12-18"), false);
    assert.equal(isForecastOpen("2026-12-18", "2026-12-19"), false);
  });

  it("resolves 14 days after the release", () => {
    assert.equal(resolveOnOf("2026-12-18"), "2027-01-01");
  });

  it("the closest forecast wins and a tie is a tie", () => {
    const forecasts = [
      { id: "ana", guess: 70 },
      { id: "beto", guess: 72 },
      { id: "caro", guess: 81 },
    ];
    assert.deepEqual(closestOf(forecasts, 70).map((f) => f.id), ["ana"]);
    // 7.0 and 7.2 are both 0.1 away from 7.1: both win.
    assert.deepEqual(closestOf(forecasts, 71).map((f) => f.id), ["ana", "beto"]);
    assert.deepEqual(closestOf([], 71), []);
  });

  it("others are revealed only after saving, or once closed", () => {
    assert.equal(mayRevealOthers({ mine: null, releaseDate: "2026-12-18", today: "2026-12-10" }), false);
    assert.equal(mayRevealOthers({ mine: 74, releaseDate: "2026-12-18", today: "2026-12-10" }), true);
    assert.equal(mayRevealOthers({ mine: null, releaseDate: "2026-12-18", today: "2026-12-18" }), true);
  });

  it("phases and chips", () => {
    const estreno = { releaseDate: "2026-12-18", resolveOn: "2027-01-01", actual: null };
    assert.equal(estrenoPhase(estreno, "2026-12-13"), "abierta");
    assert.equal(estrenoChip(estreno, "2026-12-13"), "cierra en 5 días");
    assert.equal(estrenoChip(estreno, "2026-12-17"), "cierra mañana");
    assert.equal(estrenoPhase(estreno, "2026-12-18"), "cerrada");
    assert.equal(estrenoChip(estreno, "2026-12-20"), "se resuelve el 1 ene");
    assert.equal(estrenoPhase(estreno, "2027-01-03"), "pendiente");
    assert.equal(estrenoPhase({ ...estreno, actual: 71 }, "2027-01-03"), "resuelta");
    assert.equal(daysUntil("2026-12-18", "2026-12-13"), 5);
  });

  it("guesses are whole tenths between 1.0 and 10.0", () => {
    assert.equal(parseGuess(74), 74);
    assert.equal(parseGuess("74"), 74);
    assert.equal(parseGuess(7.4), null);
    assert.equal(parseGuess(5), null);
    assert.equal(parseGuess(101), null);
    assert.equal(ratingToTenths(7.14), 71);
    assert.equal(ratingToTenths(7.15), 72);
  });

  it("months", () => {
    assert.deepEqual(monthBounds("2027-02"), { from: "2027-02-01", to: "2027-02-28" });
    assert.equal(previousMonth("2027-01"), "2026-12");
  });

  it("picks the month's most popular releases still open, keeping the ones already picked", () => {
    const candidates = [
      { catalogId: "a", mxReleaseDate: "2026-12-04", popularity: 90 },
      { catalogId: "b", mxReleaseDate: "2026-12-18", popularity: 80 },
      { catalogId: "c", mxReleaseDate: "2026-12-25", popularity: 70 },
      { catalogId: "d", mxReleaseDate: "2026-12-11", popularity: 60 },
      { catalogId: "e", mxReleaseDate: "2027-01-08", popularity: 99 },
    ];
    const first = pickEstrenos({ month: "2026-12", today: "2026-12-01", existing: [], candidates });
    assert.deepEqual(first.map((pick) => pick.catalogId), ["a", "b", "c"]);
    assert.equal(first.length, ESTRENOS_PER_MONTH);
    // On the 10th «a» already premiered: a free place is filled only by one still open.
    const later = pickEstrenos({ month: "2026-12", today: "2026-12-10", existing: ["b"], candidates });
    assert.deepEqual(later.map((pick) => pick.catalogId), ["c", "d"]);
    assert.deepEqual(pickEstrenos({ month: "2026-12", today: "2026-12-01", existing: ["a", "b", "c"], candidates }), []);
  });
});
