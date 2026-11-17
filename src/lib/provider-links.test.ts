import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLATFORMS } from "@/lib/labels";
import { PLATFORM_SEARCH_URL, providerHasOwnLink, providerWatchHref } from "@/lib/provider-links";

const offer = (providerId: number, name: string) => ({ providerId, name });
const JW = "https://www.themoviedb.org/movie/429200-good-time/watch?locale=MX";

describe("platform chips open the service (FIL-I59)", () => {
  it("searches the title inside the apps that open from a link", () => {
    assert.equal(
      providerWatchHref(offer(8, "Netflix"), "Good Time", JW),
      "https://www.netflix.com/search?q=Good%20Time",
    );
    assert.equal(
      providerWatchHref(offer(119, "Amazon Prime Video"), "Good Time", JW),
      "https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Good%20Time",
    );
    assert.equal(
      providerWatchHref(offer(1899, "Max"), "Good Time", JW),
      "https://play.hbomax.com/search?q=Good%20Time",
    );
    assert.equal(
      providerWatchHref(offer(350, "Apple TV+"), "Good Time", JW),
      "https://tv.apple.com/mx/search?term=Good%20Time",
    );
  });

  it("encodes accents and symbols in the title", () => {
    assert.equal(
      providerWatchHref(offer(8, "Netflix"), "Amélie & Nino", JW),
      "https://www.netflix.com/search?q=Am%C3%A9lie%20%26%20Nino",
    );
  });

  it("sends stores and add-on channels to the app that sells them", () => {
    assert.match(providerWatchHref(offer(10, "Amazon Video"), "Good Time", JW)!, /^https:\/\/www\.primevideo\.com\/search/);
    assert.match(providerWatchHref(offer(2100, "Amazon Prime Video with Ads"), "Good Time", JW)!, /primevideo\.com/);
    assert.match(providerWatchHref(offer(2, "Apple TV"), "Good Time", JW)!, /^https:\/\/tv\.apple\.com\//);
    assert.match(providerWatchHref(offer(3, "Google Play Movies"), "Good Time", JW)!, /^https:\/\/play\.google\.com\/store\/search\?q=Good%20Time&c=movies$/);
    assert.match(providerWatchHref(offer(1825, "HBO Max Amazon Channel"), "Good Time", JW)!, /primevideo\.com/);
    assert.match(providerWatchHref(offer(1852, "MGM Plus Apple TV Channel"), "Good Time", JW)!, /tv\.apple\.com/);
  });

  it("keeps the JustWatch link when the service has no reliable URL or there is no title", () => {
    assert.equal(providerWatchHref(offer(9999, "Cine Club Raro"), "Good Time", JW), JW);
    assert.equal(providerWatchHref(offer(1853, "Paramount Plus Premium"), "Good Time", JW), JW);
    assert.equal(providerWatchHref(offer(190, "Curiosity Stream"), "Good Time", JW), JW);
    assert.equal(providerWatchHref(offer(8, "Netflix"), "   ", JW), JW);
    assert.equal(providerWatchHref(offer(9999, "Cine Club Raro"), "Good Time"), null);
    assert.equal(providerHasOwnLink(offer(9999, "Cine Club Raro")), false);
    assert.equal(providerHasOwnLink(offer(8, "Netflix")), true);
  });

  it("covers every platform on purpose: an https URL or an explicit null", () => {
    for (const platform of PLATFORMS) {
      assert.ok(platform in PLATFORM_SEARCH_URL, platform);
      const build = PLATFORM_SEARCH_URL[platform];
      if (build) {
        assert.match(build("x"), /^https:\/\//, platform);
      }
    }
  });
});
