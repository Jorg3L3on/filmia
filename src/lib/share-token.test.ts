import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signShareToken, verifyShareToken } from "./share-token";

const SECRET = "test-secret";
const ID = "clx9w2k3h0000qz8r4v6y7t1a";

describe("share tokens", () => {
  it("round-trips the id", () => {
    const token = signShareToken("resena", ID, SECRET);
    assert.equal(verifyShareToken("resena", token, SECRET), ID);
    assert.equal(verifyShareToken("resena", encodeURIComponent(token), SECRET), ID);
  });

  it("a bare id is not a link", () => {
    assert.equal(verifyShareToken("resena", ID, SECRET), null);
  });

  it("a token is bound to its kind, id and secret", () => {
    const token = signShareToken("resena", ID, SECRET);
    assert.equal(verifyShareToken("lista", token, SECRET), null);
    assert.equal(verifyShareToken("resena", token, "other-secret"), null);
    const sig = token.split(".")[1];
    assert.equal(verifyShareToken("resena", `clx9w2k3h0000qz8r4v6y7t1b.${sig}`, SECRET), null);
    assert.equal(verifyShareToken("resena", `${token}x`, SECRET), null);
    assert.equal(verifyShareToken("resena", `${token}.extra`, SECRET), null);
  });

  it("no secret, no links", () => {
    assert.throws(() => signShareToken("resena", ID, ""));
    assert.equal(verifyShareToken("resena", signShareToken("resena", ID, SECRET), ""), null);
  });
});
