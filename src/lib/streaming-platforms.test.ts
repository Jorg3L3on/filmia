import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMinePlatformsFilter } from "@/lib/streaming-platforms";

const providers = (...ids: number[]) => ({
  flatrate: ids.map((providerId) => ({ providerId, providerName: "", logoPath: null })),
  rent: [],
  buy: [],
});

describe("applyMinePlatformsFilter", () => {
  it("matches TMDB flatrate providers", () => {
    const { visible } = applyMinePlatformsFilter(
      [{ id: "a", watchProvidersMx: providers(8), platform: null }],
      ["NETFLIX"],
    );
    assert.deepEqual(visible.map((title) => title.id), ["a"]);
  });

  it("trusts TMDB over the saved platform once availability is known", () => {
    const { visible } = applyMinePlatformsFilter(
      [
        { id: "moved", watchProvidersMx: providers(8), platform: "DISNEY" as const },
        { id: "gone", watchProvidersMx: providers(), platform: "DISNEY" as const },
      ],
      ["DISNEY"],
    );
    assert.deepEqual(visible, []);
  });

  it("matches the saved platform without a provider cache and does not count it as missing", () => {
    const result = applyMinePlatformsFilter(
      [
        { id: "saved", watchProvidersMx: null, platform: "DISNEY" as const },
        { id: "unknown", watchProvidersMx: null, platform: null },
      ],
      ["DISNEY"],
    );
    assert.deepEqual(result.visible.map((title) => title.id), ["saved"]);
    assert.equal(result.missingCache, 1);
  });

  it("excludes titles on other platforms", () => {
    const { visible } = applyMinePlatformsFilter(
      [{ id: "a", watchProvidersMx: providers(337), platform: "MAX" as const }],
      ["NETFLIX"],
    );
    assert.deepEqual(visible, []);
  });
});
