import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TonightCard, TonightDecks } from "@/lib/tonight-store";
import { moodById } from "./budget";
import { filterRecommendations } from "./recommend";

const card = (id: string, runtimeMinutes: number | null, ...genres: string[]) =>
  ({
    id,
    runtimeMinutes,
    kind: "MOVIE",
    genres: genres.map((name, index) => ({ id: index, name })),
    flatrateProviders: [],
  }) as unknown as TonightCard;

const decks = {
  lenses: [
    { slug: "para-ti", titles: [card("a", 95, "Comedia"), card("b", 120, "Ciencia ficción", "Drama")] },
    { slug: "drama", titles: [card("b", 120, "Ciencia ficción", "Drama"), card("c", 88, "Drama")] },
  ],
  userPlatforms: [],
} as unknown as TonightDecks;

const ids = (cards: TonightCard[]) => cards.map((c) => c.id);

describe("filterRecommendations with genres (FIL-I31-2)", () => {
  it("no genres: unchanged, deduplicated, in deck order", () => {
    assert.deepEqual(ids(filterRecommendations(decks, {})), ["a", "b", "c"]);
  });

  it("`genre` stays a substring match on one name, as the MCP recommend tool uses it", () => {
    assert.deepEqual(ids(filterRecommendations(decks, { genre: "ficcion" })), ["b"]);
    assert.deepEqual(ids(filterRecommendations(decks, { genre: "drama", maxRuntimeMin: 100 })), ["c"]);
  });

  it("`genres` is any-match on whole names and applies with the time limit", () => {
    const emocionarme = moodById("emocionarme")?.genres ?? [];
    assert.deepEqual(ids(filterRecommendations(decks, { genres: [...emocionarme] })), ["b", "c"]);
    assert.deepEqual(ids(filterRecommendations(decks, { genres: [...emocionarme], maxRuntimeMin: 90 })), ["c"]);
  });
});
