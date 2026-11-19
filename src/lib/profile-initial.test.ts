import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { profileInitial } from "./profile-initial";

describe("profileInitial (FIL-I60-1)", () => {
  it("takes the name's initial, else the email's", () => {
    assert.equal(profileInitial("  ana ", "z@x.test"), "A");
    assert.equal(profileInitial(null, "jorge@x.test"), "J");
    assert.equal(profileInitial("", " écija@x.test"), "É");
    assert.equal(profileInitial(null, ""), "·");
  });
});
