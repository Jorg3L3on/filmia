import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dismissToast,
  getToasts,
  showToast,
} from "./toast";
import { TMDB_UNAVAILABLE_COPY, TmdbRequestError, tmdbErrorMessage } from "./tmdb";

describe("showToast", () => {
  it("keeps the latest toasts and can dismiss them", () => {
    for (const item of getToasts()) {
      dismissToast(item.id);
    }
    showToast({ title: "Uno" });
    showToast({ title: "Dos" });
    const third = showToast({ title: "Tres" });
    const fourth = showToast({ title: "Cuatro" });
    const titles = getToasts().map((item) => item.title);
    assert.deepEqual(titles, ["Dos", "Tres", "Cuatro"]);
    dismissToast(third);
    assert.deepEqual(
      getToasts().map((item) => item.title),
      ["Dos", "Cuatro"],
    );
    dismissToast(fourth);
    dismissToast(getToasts()[0]?.id ?? -1);
    assert.equal(getToasts().length, 0);
  });
});

describe("tmdb user copy", () => {
  it("hides infra names when the API key is missing", () => {
    const error = new TmdbRequestError(
      "missing_key",
      "Falta TMDB_API_KEY. Agrégala en el entorno para buscar títulos.",
    );
    assert.equal(tmdbErrorMessage(error), TMDB_UNAVAILABLE_COPY);
    assert.equal(error.message.includes("TMDB_API_KEY"), true);
    assert.equal(TMDB_UNAVAILABLE_COPY.includes("TMDB_API_KEY"), false);
    assert.equal(TMDB_UNAVAILABLE_COPY.includes(".env"), false);
  });

  it("maps unauthorized TMDB responses to the same friendly copy", () => {
    const unauthorized = new TmdbRequestError("http", "TMDB respondió 401.", 401);
    assert.equal(tmdbErrorMessage(unauthorized), TMDB_UNAVAILABLE_COPY);
    assert.equal(tmdbErrorMessage(unauthorized).includes("401"), false);
    assert.equal(
      tmdbErrorMessage(new Error("Falta TMDB_API_KEY en .env")),
      TMDB_UNAVAILABLE_COPY,
    );
  });
});
