import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeTitleExtras,
  storedTitleExtras,
  titleExtrasPatch,
  titleNeedsTmdbExtras,
  type TitleExtrasRow,
} from "./title-extras-core";

const baseTitle = (): TitleExtrasRow => ({
  id: "title-1",
  userId: "user-1",
  tmdbId: 8363,
  kind: "MOVIE",
  posterPath: null,
  overview: null,
  tmdbGenres: [],
  runtimeMinutes: null,
  backdropPath: null,
});

const fetched = {
  overview: "Dos amigos intentan comprar alcohol.",
  runtimeMinutes: 113,
  backdropPath: "/superbad-back.jpg",
  posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
  genres: [{ id: 35, name: "Comedia" }],
  tmdbId: 8363,
};

describe("titleNeedsTmdbExtras", () => {
  it("skips titles without a TMDB id", () => {
    assert.equal(titleNeedsTmdbExtras({ ...baseTitle(), tmdbId: null }), false);
  });

  it("fetches when poster, overview, or genres are missing", () => {
    assert.equal(titleNeedsTmdbExtras(baseTitle()), true);
    assert.equal(
      titleNeedsTmdbExtras({ ...baseTitle(), posterPath: "/p.jpg", overview: "Sinopsis" }),
      true,
    );
  });

  it("skips a warm Superbad-style row even if runtime is still empty", () => {
    assert.equal(
      titleNeedsTmdbExtras({
        ...baseTitle(),
        posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
        overview: "Dos amigos intentan comprar alcohol.",
        tmdbGenres: [{ id: 35, name: "Comedia" }],
        runtimeMinutes: null,
      }),
      false,
    );
  });
});

describe("titleExtrasPatch", () => {
  it("fills poster, overview, runtime, backdrop and genres on a gap row", () => {
    assert.deepEqual(titleExtrasPatch(baseTitle(), fetched), {
      overview: "Dos amigos intentan comprar alcohol.",
      posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
      backdropPath: "/superbad-back.jpg",
      runtimeMinutes: 113,
      tmdbGenres: [{ id: 35, name: "Comedia" }],
    });
  });

  it("does not overwrite stored extras", () => {
    const current: TitleExtrasRow = {
      ...baseTitle(),
      posterPath: "/kept.jpg",
      overview: "Mi sinopsis",
      tmdbGenres: [{ id: 18, name: "Drama" }],
      runtimeMinutes: 90,
      backdropPath: "/kept-back.jpg",
    };

    assert.deepEqual(titleExtrasPatch(current, fetched), {});
  });

  it("fills only the Superbad missing poster", () => {
    const current: TitleExtrasRow = {
      ...baseTitle(),
      overview: "Ya hay sinopsis",
      tmdbGenres: [{ id: 35, name: "Comedia" }],
    };

    assert.deepEqual(titleExtrasPatch(current, fetched), {
      posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
      backdropPath: "/superbad-back.jpg",
      runtimeMinutes: 113,
    });
  });
});

describe("mergeTitleExtras / storedTitleExtras", () => {
  it("prefers stored fields and fills gaps from TMDB", () => {
    const current: TitleExtrasRow = {
      ...baseTitle(),
      overview: "  Guardada  ",
      posterPath: null,
    };

    assert.deepEqual(mergeTitleExtras(current, fetched), {
      overview: "Guardada",
      runtimeMinutes: 113,
      backdropPath: "/superbad-back.jpg",
      posterPath: "/ek8e8txUyUwd2BNqj6lFEerJfbq.jpg",
      genres: [{ id: 35, name: "Comedia" }],
    });
  });

  it("reads stored extras without a network payload", () => {
    assert.deepEqual(
      storedTitleExtras({
        ...baseTitle(),
        posterPath: "/p.jpg",
        overview: " Texto ",
        tmdbGenres: [{ id: 35, name: "Comedia" }],
        runtimeMinutes: 113,
        backdropPath: "/b.jpg",
      }),
      {
        overview: "Texto",
        runtimeMinutes: 113,
        backdropPath: "/b.jpg",
        posterPath: "/p.jpg",
        genres: [{ id: 35, name: "Comedia" }],
      },
    );
  });
});
