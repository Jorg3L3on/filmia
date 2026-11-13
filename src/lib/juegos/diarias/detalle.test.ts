import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIARIA_MIN_VOTES, diariaNumber, diariaSeed, diariaShareText, parseTitleGuess } from "@/lib/juegos/diarias/core";
import {
  buildDetalleRound,
  cropAllowed,
  DETALLE_FRACTIONS,
  DETALLE_LEVELS,
  DETALLE_MAX,
  detalleCrop,
  detalleMarks,
  detalleState,
  type DetalleAnswer,
  type DetalleCandidate,
} from "@/lib/juegos/diarias/detalle";

const pool: DetalleCandidate[] = Array.from({ length: 40 }, (_, index) => ({
  id: `c${String(index).padStart(3, "0")}`,
  tmdbId: 1000 + index,
  posterPath: `/poster${index}.jpg`,
  imdbVotes: DIARIA_MIN_VOTES + index,
}));

const miss = (p: number, n: string | null = "Otra"): DetalleAnswer => ({ p, g: n ? 1 : null, n, ok: false });
const hit = (p: number): DetalleAnswer => ({ p, g: 2, n: "Esa", ok: true });

describe("Detalle: the round from the seed (FIL-I54-1)", () => {
  it("the same seed gives the same posters, zones and crops, whatever the pool's order", () => {
    const seed = diariaSeed("detalle", "2026-11-20");
    const first = buildDetalleRound({ pool, seed })!;
    const second = buildDetalleRound({ pool: [...pool].reverse(), seed })!;
    assert.deepEqual(first, second);
    assert.equal(first.posters.length, 3);
    assert.notDeepEqual(first, buildDetalleRound({ pool, seed: diariaSeed("detalle", "2026-11-21") }));
    for (const poster of first.posters) {
      const levels = Array.from({ length: DETALLE_LEVELS }, (_, index) => detalleCrop({ ...poster, level: index + 1, width: 500, height: 750 }));
      const again = Array.from({ length: DETALLE_LEVELS }, (_, index) => detalleCrop({ ...poster, level: index + 1, width: 500, height: 750 }));
      assert.deepEqual(levels, again);
      // Six levels, each wider than the one before, all inside the poster.
      for (let index = 1; index < levels.length; index += 1) assert.ok(levels[index]!.width > levels[index - 1]!.width);
      for (const crop of levels) {
        assert.ok(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 500 && crop.top + crop.height <= 750);
      }
    }
  });

  it("zones stay away from the edges", () => {
    for (let day = 1; day <= 30; day += 1) {
      const round = buildDetalleRound({ pool, seed: `s${day}` })!;
      for (const poster of round.posters) {
        assert.ok(poster.x >= 0.25 && poster.x <= 0.75, `x ${poster.x}`);
        assert.ok(poster.y >= 0.18 && poster.y <= 0.68, `y ${poster.y}`);
      }
    }
  });

  it("skips films of recent rounds, unknown films and posters not from TMDB", () => {
    const exclude = new Set(pool.slice(0, 37).map((film) => film.id));
    const round = buildDetalleRound({ pool, seed: "x", exclude })!;
    assert.deepEqual(round.posters.map((poster) => poster.catalogId).sort(), ["c037", "c038", "c039"]);
    const odd = [
      { id: "a", tmdbId: 1, posterPath: "/posters/local.jpg", imdbVotes: DIARIA_MIN_VOTES },
      { id: "b", tmdbId: 2, posterPath: "/b.jpg", imdbVotes: DIARIA_MIN_VOTES - 1 },
      { id: "c", tmdbId: 3, posterPath: null, imdbVotes: DIARIA_MIN_VOTES },
    ];
    assert.equal(buildDetalleRound({ pool: odd, seed: "x" }), null);
  });

  it("the crop of the last level is still not the whole poster", () => {
    const crop = detalleCrop({ x: 0.5, y: 0.5, level: DETALLE_LEVELS, width: 500, height: 750 });
    assert.equal(crop.width, Math.round(500 * DETALLE_FRACTIONS.at(-1)!));
    assert.ok(crop.width * crop.height < 500 * 750 / 2);
  });
});

describe("Detalle: a partida from its answers (FIL-I54-1)", () => {
  it("a miss opens the crop; a hit scores 7 − level and moves on; six misses fail the poster", () => {
    const answers = [miss(0), miss(0, null), hit(0), ...Array.from({ length: 6 }, () => miss(1)), hit(2)];
    const state = detalleState(answers);
    assert.equal(state.posters[0]!.status, "solved");
    assert.equal(state.posters[0]!.level, 3);
    assert.equal(state.posters[0]!.points, 4);
    assert.deepEqual(state.posters[0]!.misses, ["Otra"]);
    assert.equal(state.posters[1]!.status, "failed");
    assert.equal(state.posters[1]!.points, 0);
    assert.equal(state.posters[2]!.points, 6);
    assert.equal(state.score, 10);
    assert.ok(state.finished);
    assert.equal(detalleMarks(state), "🟨🟥🟩");
    assert.equal(DETALLE_MAX, 18);
  });

  it("only the current poster may be cut, and only up to its level", () => {
    const state = detalleState([miss(0)]);
    assert.ok(cropAllowed(state, 0, 1));
    assert.ok(cropAllowed(state, 0, 2));
    assert.ok(!cropAllowed(state, 0, 3), "a level not reached yet");
    assert.ok(!cropAllowed(state, 1, 1), "the next poster");
    assert.ok(!cropAllowed(state, 0, 0));
    assert.ok(!cropAllowed(state, 0, 7));
  });

  it("answers for another poster are ignored", () => {
    assert.equal(detalleState([hit(1)]).current, 0);
  });
});

describe("Las diarias: what they share (FIL-I54)", () => {
  it("numbers, guesses and the shared text name no film", () => {
    assert.equal(diariaNumber("detalle", "2026-11-20"), 1, "before the launch it is still n.º 1");
    assert.equal(diariaNumber("detalle", "2026-11-23"), 1);
    assert.equal(diariaNumber("detalle", "2026-12-02"), 10);
    assert.deepEqual(parseTitleGuess({ tmdbId: "603", name: " Matrix " }), { tmdbId: 603, name: "Matrix" });
    assert.equal(parseTitleGuess({ tmdbId: 0, name: "x" }), null);
    assert.equal(parseTitleGuess({ tmdbId: 3, name: "" }), null);
    const text = diariaShareText({ id: "detalle", day: "2026-11-24", score: "10 de 18", marks: "🟨🟥🟩", url: "https://x/extras" });
    assert.equal(text, "Filmia · Detalle n.º 2\n10 de 18\n🟨🟥🟩\nhttps://x/extras");
  });
});
