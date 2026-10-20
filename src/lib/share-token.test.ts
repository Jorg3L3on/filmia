import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compatShareId, parseCompatShareId, signShareToken, verifyShareToken } from "./share-token";

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

  it("compat (FIL-I19-4): one id per list and pair, bound to its kind", () => {
    const LIST = "clx9w2k3h0000qz8r4v6y7t1l";
    const ANA = "clx9w2k3h0000qz8r4v6y7taa";
    const JORGE = "clx9w2k3h0000qz8r4v6y7tjj";
    const id = compatShareId(LIST, JORGE, ANA);
    assert.equal(id, compatShareId(LIST, ANA, JORGE), "same link whoever shares it");
    assert.deepEqual(parseCompatShareId(id), { listId: LIST, userA: ANA, userB: JORGE });

    const token = signShareToken("compat", id, SECRET);
    assert.equal(verifyShareToken("compat", token, SECRET), id);
    assert.equal(verifyShareToken("lista", token, SECRET), null, "a compat token is not a list link");
    assert.equal(verifyShareToken("resena", token, SECRET), null);
    const listToken = signShareToken("lista", LIST, SECRET);
    assert.equal(verifyShareToken("compat", listToken, SECRET), null, "a list token is not a compat card");
    const sig = token.split(".")[1];
    assert.equal(verifyShareToken("compat", `${compatShareId(LIST, ANA, "clx9w2k3h0000qz8r4v6y7tzz")}.${sig}`, SECRET), null);
    assert.equal(verifyShareToken("compat", `${LIST}-${ANA}.${sig}`, SECRET), null, "malformed id");
  });

  it("no secret, no links", () => {
    assert.throws(() => signShareToken("resena", ID, ""));
    assert.equal(verifyShareToken("resena", signShareToken("resena", ID, SECRET), ""), null);
  });
});
