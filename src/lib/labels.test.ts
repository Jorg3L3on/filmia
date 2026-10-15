import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imdbTitleUrl } from "@/lib/labels";

describe("imdbTitleUrl", () => {
  it("links the title page", () => {
    assert.equal(imdbTitleUrl("tt0050083"), "https://www.imdb.com/title/tt0050083/");
    assert.equal(imdbTitleUrl(" tt15239678 "), "https://www.imdb.com/title/tt15239678/");
  });

  it("no imdb id, no link", () => {
    assert.equal(imdbTitleUrl(null), null);
    assert.equal(imdbTitleUrl(""), null);
    assert.equal(imdbTitleUrl("nm0000123"), null);
    assert.equal(imdbTitleUrl("tt12/../x"), null);
  });
});
