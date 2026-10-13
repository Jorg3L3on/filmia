import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handoffKey, parseHandoffs, withHandoff } from "./ficha-handoff";

describe("ficha handoff", () => {
  it("keeps what a ficha learned and never forgets an earlier save", () => {
    const key = handoffKey("MOVIE", 340666);
    const first = withHandoff({}, key, { titleId: "t1", inWatchlist: true, watched: false }, 1_000);
    const second = withHandoff(first, key, { titleId: "t1", inWatchlist: false, watched: true }, 2_000);
    assert.deepEqual(second[key], { titleId: "t1", inWatchlist: true, watched: true, at: 2_000 });
  });

  it("drops stale or malformed entries", () => {
    const raw = JSON.stringify({
      "MOVIE:1": { titleId: "a", inWatchlist: true, watched: false, at: 0 },
      "MOVIE:2": { titleId: "b", inWatchlist: true, watched: false, at: 3_600_000 },
      "MOVIE:3": { titleId: 3 },
    });
    assert.deepEqual(Object.keys(parseHandoffs(raw, 3_700_000)), ["MOVIE:2"]);
    assert.deepEqual(parseHandoffs("not json"), {});
    assert.deepEqual(parseHandoffs(null), {});
  });
});
