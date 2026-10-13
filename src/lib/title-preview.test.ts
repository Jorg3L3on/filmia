import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogNeedsEnrichment,
  diaryDayLabel,
  diaryMonthHref,
  kindFromSlug,
  ownedFichaHref,
  parseDiaryLog,
  parseTmdbIdParam,
  previewFichaHref,
} from "./title-preview";

describe("title preview route", () => {
  it("maps the Spanish kind slugs and rejects anything else", () => {
    assert.equal(kindFromSlug("pelicula"), "MOVIE");
    assert.equal(kindFromSlug("serie"), "SERIES");
    assert.equal(kindFromSlug("MOVIE"), null);
    assert.equal(kindFromSlug("película"), null);
  });

  it("parses only positive integer TMDB ids", () => {
    assert.equal(parseTmdbIdParam("1229730"), 1229730);
    assert.equal(parseTmdbIdParam("0"), null);
    assert.equal(parseTmdbIdParam("-3"), null);
    assert.equal(parseTmdbIdParam("12abc"), null);
    assert.equal(parseTmdbIdParam("1e5"), null);
    assert.equal(parseTmdbIdParam("99999999999"), null);
  });

  it("builds the preview and owned hrefs, carrying Diario mode", () => {
    assert.equal(previewFichaHref("MOVIE", 42), "/titulos/tmdb/pelicula/42");
    assert.equal(previewFichaHref("SERIES", 7), "/titulos/tmdb/serie/7");
    assert.equal(
      previewFichaHref("MOVIE", 42, { date: "2026-10-12" }),
      "/titulos/tmdb/pelicula/42?fecha=2026-10-12&destino=visto",
    );
    assert.equal(previewFichaHref("MOVIE", 42, { date: null }), "/titulos/tmdb/pelicula/42?destino=visto");
    assert.equal(ownedFichaHref("abc"), "/titulos/abc");
    assert.equal(ownedFichaHref("abc", { date: "2026-10-12" }), "/titulos/abc?fecha=2026-10-12&destino=visto");
  });
});

describe("Diario mode", () => {
  it("follows Buscar: a valid fecha or destino=visto", () => {
    assert.deepEqual(parseDiaryLog({ fecha: "2026-10-12", destino: "visto" }), { date: "2026-10-12" });
    assert.deepEqual(parseDiaryLog({ fecha: "2026-10-12" }), { date: "2026-10-12" });
    assert.deepEqual(parseDiaryLog({ destino: "visto" }), { date: null });
    assert.equal(parseDiaryLog({ fecha: "2026-13-40" }), null);
    assert.equal(parseDiaryLog({}), null);
  });

  it("labels the day like the calendar and links back to its month", () => {
    assert.equal(diaryDayLabel("2026-10-12"), "lun 12 oct");
    assert.equal(diaryDayLabel("2026-10-11"), "dom 11 oct");
    assert.equal(diaryDayLabel(null), "hoy");
    assert.equal(diaryMonthHref("2026-10-12"), "/diario?month=2026-10");
    assert.equal(diaryMonthHref(null), "/diario");
  });
});

describe("catalogNeedsEnrichment", () => {
  it("is true only for a search snapshot", () => {
    assert.equal(catalogNeedsEnrichment({ imdbId: null, runtimeMinutes: null, tmdbGenres: [] }), true);
    assert.equal(catalogNeedsEnrichment({ imdbId: null, runtimeMinutes: 109, tmdbGenres: [] }), true);
    assert.equal(
      catalogNeedsEnrichment({ imdbId: null, runtimeMinutes: 109, tmdbGenres: [{ id: 53, name: "Suspense" }] }),
      false,
    );
    assert.equal(catalogNeedsEnrichment({ imdbId: "tt123", runtimeMinutes: null, tmdbGenres: [] }), false);
  });
});
