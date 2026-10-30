import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CriticsPill } from "@/components/CriticsPill";

const render = (props: Parameters<typeof CriticsPill>[0]) => renderToStaticMarkup(createElement(CriticsPill, props));

describe("CriticsPill (FIL-I36)", () => {
  it("draws the three scores with their labels", () => {
    const html = render({
      name: "Duna: Parte dos",
      imdbRating: 8.4,
      imdbHref: "https://www.imdb.com/title/tt15239678/",
      rtScore: 92,
      metascore: 79,
    });
    assert.match(html, /aria-label="IMDb 8\.4 de 10: abrir en IMDb"/);
    assert.match(html, /aria-label="Rotten Tomatoes 92 %"/);
    assert.match(html, /aria-label="Metacritic 79 de 100"/);
    assert.match(html, /92%/);
    assert.match(html, /bg-\[#54b948\]/);
    assert.equal(html.match(/w-px/g)?.length, 2, "two dividers between three segments");
  });

  it("leaves out a score OMDb did not send, with no empty segment", () => {
    const html = render({ name: "Resident Evil", imdbRating: 6.2, imdbHref: null, rtScore: 96, metascore: null });
    assert.match(html, /Rotten Tomatoes 96 %/);
    assert.doesNotMatch(html, /Metacritic/);
    assert.equal(html.match(/w-px/g)?.length, 1);
  });

  it("draws nothing at all without scores", () => {
    assert.equal(render({ name: "Sin datos", imdbRating: null, rtScore: null, metascore: null }), "");
  });

  it("uses the splat below 60 % and the red swatch below 40", () => {
    const html = render({ name: "X", rtScore: 41, metascore: 32 });
    assert.match(html, /#7cb342/);
    assert.doesNotMatch(html, /#fa320a/);
    assert.match(html, /bg-\[#c9343a\] text-white/);
  });
});
