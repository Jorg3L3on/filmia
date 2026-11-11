import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posterFlightFor, rememberPosterFlight, titleIdFromHref } from "./poster-flight";

describe("poster flight (FIL-I46-2)", () => {
  it("reads the title id from a ficha link", () => {
    assert.equal(titleIdFromHref("/titulos/abc123"), "abc123");
    assert.equal(titleIdFromHref("/titulos/abc123?carta=1"), "abc123");
    assert.equal(titleIdFromHref("http://127.0.0.1:3051/titulos/abc123/"), "abc123");
    assert.equal(titleIdFromHref("/titulos/nuevo"), null);
    assert.equal(titleIdFromHref("/titulos/tmdb/movie/550"), null);
    assert.equal(titleIdFromHref("/listas"), null);
    assert.equal(titleIdFromHref(null), null);
  });

  it("remembers the tapped poster for a few seconds only", () => {
    rememberPosterFlight("t1", "/_next/image?url=a.jpg", 1000);
    assert.equal(posterFlightFor("t1", 2000), "/_next/image?url=a.jpg");
    assert.equal(posterFlightFor("t1", 1000 + 9000), null);
    assert.equal(posterFlightFor("other", 2000), null);
  });
});

import { cssTimeMs, flipFrom, markHistoryPop, rememberPosterRect, takePosterReturn } from "./poster-flight";

describe("poster return flight (FIL-I46-2)", () => {
  const ficha = { x: 110, y: 70, width: 168, height: 252 };
  const row = { x: 16, y: 240, width: 84, height: 126 };

  it("only flies home right after a history traversal, and only the opened poster", () => {
    rememberPosterFlight("t2", "", 9_900);
    rememberPosterRect("other", ficha, 10_000);
    rememberPosterRect("t2", ficha, 10_000);
    assert.equal(takePosterReturn("t2", 10_200), null, "no pop yet: a forward tap has its view transition");
    rememberPosterRect("t2", ficha, 10_000);
    markHistoryPop(10_100);
    assert.equal(takePosterReturn("other", 10_300), null, "a poster the tap did not open stays put");
    assert.deepEqual(takePosterReturn("t2", 10_300), ficha);
    assert.equal(takePosterReturn("t2", 10_300), null, "used once");
  });

  it("maps the ficha poster onto the row tile", () => {
    assert.deepEqual(flipFrom(ficha, row), { x: 94, y: -170, sx: 2, sy: 2 });
  });
});

describe("cssTimeMs", () => {
  it("reads ms and s tokens", () => {
    assert.equal(cssTimeMs(" 380ms"), 380);
    assert.equal(cssTimeMs("0.38s"), 380);
    assert.equal(cssTimeMs("bogus"), 0);
  });
});
