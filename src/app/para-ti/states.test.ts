import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ParaTiError from "./error";
import Loading from "./loading";

describe("Para ti states (FIL-I60-4)", () => {
  it("the loading screen is the real question and the eight words, with the shelves as blocks", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    assert.match(html, /¿Qué se te antoja\?/);
    for (const label of ["Reír", "Llorar", "Miedo", "Adrenalina", "Pensar", "Algo reciente", "Corta", "Joya escondida"]) {
      assert.ok(html.includes(label), label);
    }
    assert.match(html, /aria-label="Cargando estantes"/);
    assert.equal((html.match(/class="para-ti-shelf-row"/g) ?? []).length, 3);
  });

  it("the error boundary says it failed and offers a retry", () => {
    const html = renderToStaticMarkup(
      createElement(ParaTiError, { error: Object.assign(new Error("boom"), { digest: "x" }), reset: () => {} }),
    );
    assert.match(html, /Para ti no cargó/);
    assert.match(html, /Reintentar/);
  });
});
