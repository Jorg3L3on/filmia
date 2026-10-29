import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  durationLabel,
  filterChipLabel,
  filterChipSpoken,
  languageName,
  minePlatformsCellLabel,
  yearsLabel,
} from "@/lib/watchlist-chips";
import { EMPTY_WATCHLIST_QUERY } from "@/lib/watchlist-query";

const names = { genres: new Map([[18, "Drama"], [878, "Ciencia ficción y fantasía"]]), people: new Map([[7, "Marina Ocampo"]]) };

describe("watchlist-chips/scope cell", () => {
  it("names 1, 2, 3+ and 0 platforms", () => {
    assert.equal(minePlatformsCellLabel(["NETFLIX"]), "Netflix");
    assert.equal(minePlatformsCellLabel(["NETFLIX", "MAX"]), "Netflix y Max");
    assert.equal(minePlatformsCellLabel(["NETFLIX", "MAX", "MUBI"]), "3 plataformas");
    assert.equal(minePlatformsCellLabel([]), "Mis plataformas");
  });
});

describe("watchlist-chips/labels", () => {
  it("ranges", () => {
    assert.equal(yearsLabel({ min: 1990, max: 1999 }), "1990s");
    assert.equal(yearsLabel({ min: null, max: 1989 }), "Antes de 1990");
    assert.equal(yearsLabel({ min: 2000, max: null }), "Desde 2000");
    assert.equal(yearsLabel({ min: 1980, max: 1999 }), "Años 1980–1999");
    assert.equal(durationLabel({ min: null, max: 100 }), "Hasta 1 h 40 min");
    assert.equal(durationLabel({ min: 150, max: null }), "Más de 2 h 30 min");
    assert.equal(durationLabel({ min: 100, max: 150 }), "1 h 40 min–2 h 30 min");
  });

  it("chips name the first value and count the rest", () => {
    const query = { ...EMPTY_WATCHLIST_QUERY, genres: [18, 878], platforms: ["NETFLIX" as const], access: "rent" as const, people: [7] };
    assert.equal(filterChipLabel(query, "genres", names), "Drama +1");
    assert.equal(filterChipLabel(query, "platforms", names), "Netflix · renta o compra");
    assert.equal(filterChipLabel(query, "people", names), "Marina Ocampo");
    assert.equal(filterChipLabel({ ...query, imdbMin: 7 }, "imdb", names), "Nota 7+");
    assert.equal(filterChipLabel({ ...query, seriesStatus: "WATCHING" }, "seriesStatus", names), "Series: viendo");
  });

  it("VoiceOver reads «Quitar filtro: Drama y 1 género más»", () => {
    const query = { ...EMPTY_WATCHLIST_QUERY, genres: [18, 878] };
    assert.equal(filterChipSpoken(query, "genres", names), "Quitar filtro: Drama y 1 género más");
    assert.equal(filterChipSpoken({ ...query, short: true }, "short", names), "Quitar filtro: Cortas");
  });

  it("names languages in Spanish", () => {
    assert.equal(languageName("ja"), "Japonés");
  });
});
