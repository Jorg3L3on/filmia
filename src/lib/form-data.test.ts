import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlatform } from "@/lib/form-data";

describe("form-data/parsePlatform", () => {
  it("maps «Ninguna» (empty) to null", () => {
    assert.equal(parsePlatform(""), null);
    assert.equal(parsePlatform("   "), null);
    assert.equal(parsePlatform(null), null);
  });

  it("accepts a known platform id", () => {
    assert.equal(parsePlatform("NETFLIX"), "NETFLIX");
    assert.equal(parsePlatform(" MUBI "), "MUBI");
  });

  it("rejects anything outside the enum", () => {
    assert.throws(() => parsePlatform("HBO"), /Plataforma no válida/);
    assert.throws(() => parsePlatform("netflix"), /Plataforma no válida/);
  });
});
