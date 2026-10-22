import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heroEyebrow, sortedRankLabel, watchlistEmptyState } from "./watchlist-empty";

describe("heroEyebrow", () => {
  it("keeps «Próxima en tu lista» without a sort", () => {
    assert.equal(heroEyebrow(null), "Próxima en tu lista");
    assert.equal(heroEyebrow(null, "Netflix"), "Próxima en tu lista");
  });

  it("says what the first row is under each sort", () => {
    assert.equal(heroEyebrow("imdb"), "Mejor nota de tu lista");
    assert.equal(heroEyebrow("runtime"), "La más corta");
    assert.equal(heroEyebrow("year"), "La más antigua");
    assert.equal(heroEyebrow("added"), "La última en entrar");
    assert.equal(heroEyebrow("arrived", "Prime Video"), "Acaba de llegar a Prime Video");
    assert.equal(heroEyebrow("arrived", null), "Acaba de llegar");
  });

  it("labels sorted rows by their place", () => {
    assert.equal(sortedRankLabel(3), "#3 en tu orden");
  });
});

describe("watchlistEmptyState", () => {
  it("is null when nothing is active", () => {
    assert.equal(watchlistEmptyState("/watchlist", {}), null);
    assert.equal(watchlistEmptyState("/watchlist", { kind: "ALL", genres: [], platforms: [] }), null);
  });

  it("names the chip and drops only that parameter", () => {
    const state = watchlistEmptyState("/watchlist", { short: true, sort: "imdb" });
    assert.deepEqual(state, { culprit: "short", chip: "Cortas", clearHref: "/watchlist?sort=imdb" });
  });

  it("blames «Esta noche» before the rest, then the platforms", () => {
    assert.equal(watchlistEmptyState("/watchlist", { tonight: true, awarded: true })?.chip, "Esta noche");
    const mine = watchlistEmptyState("/watchlist", { minePlatforms: true, awarded: true });
    assert.equal(mine?.chip, "Mis plataformas");
    assert.equal(mine?.clearHref, "/watchlist?awarded=1");
    const picked = watchlistEmptyState("/watchlist", { platforms: ["NETFLIX"] }, { platformsLabel: "Netflix" });
    assert.equal(picked?.chip, "Netflix");
    assert.equal(picked?.clearHref, "/watchlist");
  });

  it("uses the genre's name when one is selected, «Género» otherwise", () => {
    assert.equal(watchlistEmptyState("/watchlist", { genres: [18] }, { genreName: "Drama" })?.chip, "Drama");
    assert.equal(watchlistEmptyState("/watchlist", { genres: [18, 878] }, { genreName: "Drama" })?.chip, "Género");
  });
});
