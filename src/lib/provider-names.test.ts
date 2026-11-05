import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUserStreamingProvider, providerDisplayName } from "@/lib/streaming-platforms";

const offer = (providerId: number, name: string) => ({ providerId, name });

describe("one name per service and «Tuya» only on the subscription (UX-04)", () => {
  it("names the services the same everywhere", () => {
    assert.equal(providerDisplayName(offer(1899, "Max")), "HBO Max");
    assert.equal(providerDisplayName(offer(1899, "HBO Max")), "HBO Max");
    assert.equal(providerDisplayName(offer(531, "Paramount Plus")), "Paramount+");
    assert.equal(providerDisplayName(offer(9999, "Paramount Plus Premium")), "Paramount+ Premium");
    assert.equal(providerDisplayName(offer(1825, "HBO Max Amazon Channel")), "HBO Max Amazon Channel");
  });

  it("marks the user's own subscription, never its add-on channels", () => {
    assert.equal(isUserStreamingProvider(offer(1899, "HBO Max"), ["MAX"]), true);
    assert.equal(isUserStreamingProvider(offer(1825, "HBO Max Amazon Channel"), ["MAX"]), false);
    assert.equal(isUserStreamingProvider(offer(582, "Paramount+ Amazon Channel"), ["PARAMOUNT"]), false);
    assert.equal(isUserStreamingProvider(offer(8, "Netflix Standard with Ads"), ["NETFLIX"]), true);
  });
});
