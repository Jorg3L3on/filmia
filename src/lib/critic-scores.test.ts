import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { metacriticTier, parseMetascore, parseRottenTomatoes, rtIsFresh } from "@/lib/critic-scores";

describe("critic-scores/parseRottenTomatoes", () => {
  it("reads the Tomatometer percentage", () => {
    const ratings = [
      { Source: "Internet Movie Database", Value: "7.5/10" },
      { Source: "Rotten Tomatoes", Value: "96%" },
      { Source: "Metacritic", Value: "72/100" },
    ];
    assert.equal(parseRottenTomatoes(ratings), 96);
  });

  it("is null when OMDb has no Rotten Tomatoes entry", () => {
    assert.equal(parseRottenTomatoes([{ Source: "Internet Movie Database", Value: "7.5/10" }]), null);
    assert.equal(parseRottenTomatoes([]), null);
    assert.equal(parseRottenTomatoes(undefined), null);
  });

  it("is null for N/A or malformed values", () => {
    assert.equal(parseRottenTomatoes([{ Source: "Rotten Tomatoes", Value: "N/A" }]), null);
    assert.equal(parseRottenTomatoes([{ Source: "Rotten Tomatoes", Value: "140%" }]), null);
    assert.equal(parseRottenTomatoes([{ Source: "Rotten Tomatoes" }]), null);
  });

  it("keeps 0 %", () => {
    assert.equal(parseRottenTomatoes([{ Source: "Rotten Tomatoes", Value: "0%" }]), 0);
  });
});

describe("critic-scores/parseMetascore", () => {
  it("reads the number", () => {
    assert.equal(parseMetascore("72"), 72);
    assert.equal(parseMetascore(" 100 "), 100);
  });

  it("is null for N/A, empty or out of range", () => {
    assert.equal(parseMetascore("N/A"), null);
    assert.equal(parseMetascore(""), null);
    assert.equal(parseMetascore(undefined), null);
    assert.equal(parseMetascore("101"), null);
  });
});

describe("critic-scores/tiers", () => {
  it("fresh from 60 %", () => {
    assert.equal(rtIsFresh(60), true);
    assert.equal(rtIsFresh(59), false);
  });

  it("Metacritic bands", () => {
    assert.equal(metacriticTier(61), "good");
    assert.equal(metacriticTier(60), "mixed");
    assert.equal(metacriticTier(40), "mixed");
    assert.equal(metacriticTier(39), "bad");
  });
});
