import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { canWatchTogether, deciders, groupRecoEnabled, parseWatching } from "./group-access";
import type { ListPerson } from "./list-invites";

const person = (id: string, role: ListPerson["role"]): ListPerson =>
  role === "OWNER"
    ? { id, name: id, role, joinedAt: null, added: 0 }
    : { id, name: id, role, joinedAt: new Date(2026, 9, 19), added: 0 };

const OWNER = person("owner", "OWNER");
const EDITOR = person("ana", "EDITOR");
const EDITOR_2 = person("diego", "EDITOR");
const VIEWER = person("leo", "VIEWER");
const LIST = { kind: "COLLECTION" as const, slug: null };

describe("group-access · who gets «Qué vemos juntos»", () => {
  const original = process.env.GROUP_RECO_ENABLED;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.GROUP_RECO_ENABLED;
    } else {
      process.env.GROUP_RECO_ENABLED = original;
    }
  });

  it("only lists with an editor, only for the owner and editors", () => {
    assert.equal(canWatchTogether(LIST, "OWNER", [OWNER, EDITOR]), true);
    assert.equal(canWatchTogether(LIST, "EDITOR", [OWNER, EDITOR]), true);
    assert.equal(canWatchTogether(LIST, "VIEWER", [OWNER, EDITOR, VIEWER]), false);
    assert.equal(canWatchTogether(LIST, "OWNER", [OWNER, VIEWER]), false, "readers alone do not make a group");
    assert.equal(canWatchTogether(LIST, "OWNER", [OWNER]), false);
  });

  it("never on fixed or non-collection lists", () => {
    assert.equal(canWatchTogether({ kind: "COLLECTION", slug: "favoritas" }, "OWNER", [OWNER, EDITOR]), false);
    assert.equal(canWatchTogether({ kind: "WATCHLIST", slug: "quiero-ver" }, "OWNER", [OWNER, EDITOR]), false);
    assert.equal(canWatchTogether({ kind: "YEAR_TOP", slug: null }, "OWNER", [OWNER, EDITOR]), false);
  });

  it("GROUP_RECO_ENABLED turns it off without a revert", () => {
    delete process.env.GROUP_RECO_ENABLED;
    assert.equal(groupRecoEnabled(), true);
    for (const off of ["0", "false", "OFF", " no "]) {
      process.env.GROUP_RECO_ENABLED = off;
      assert.equal(groupRecoEnabled(), false);
      assert.equal(canWatchTogether(LIST, "OWNER", [OWNER, EDITOR]), false);
    }
    process.env.GROUP_RECO_ENABLED = "1";
    assert.equal(groupRecoEnabled(), true);
  });

  it("readers never decide or watch", () => {
    const people = [OWNER, EDITOR, VIEWER, EDITOR_2];
    assert.deepEqual(deciders(people).map((p) => p.id), ["owner", "ana", "diego"]);
    assert.deepEqual(parseWatching(undefined, people), ["owner", "ana", "diego"], "everyone by default");
    assert.deepEqual(parseWatching("ana,leo,owner", people), ["owner", "ana"], "a reader in the URL is dropped");
    assert.deepEqual(parseWatching("leo,stranger", people), ["owner", "ana", "diego"]);
    assert.deepEqual(parseWatching(["diego", "ana"], people), ["ana", "diego"]);
  });
});
