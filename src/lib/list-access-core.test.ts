import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOnList, isShareable, roleAtLeast, shareableRoles } from "./list-access-core";

describe("canOnList (FIL-I18-2 matrix)", () => {
  it("a viewer only reads", () => {
    assert.equal(canOnList("VIEWER", "read"), true);
    assert.equal(canOnList("VIEWER", "edit_items"), false);
    assert.equal(canOnList("VIEWER", "manage"), false);
  });

  it("an editor edits films but never manages the list", () => {
    assert.equal(canOnList("EDITOR", "read"), true);
    assert.equal(canOnList("EDITOR", "edit_items"), true);
    assert.equal(canOnList("EDITOR", "manage"), false);
  });

  it("the owner can do everything", () => {
    assert.equal(canOnList("OWNER", "read"), true);
    assert.equal(canOnList("OWNER", "edit_items"), true);
    assert.equal(canOnList("OWNER", "manage"), true);
  });

  it("no role means nothing", () => {
    assert.equal(canOnList(null, "read"), false);
    assert.equal(canOnList(null, "edit_items"), false);
  });

  it("ranks roles", () => {
    assert.equal(roleAtLeast("OWNER", "EDITOR"), true);
    assert.equal(roleAtLeast("VIEWER", "EDITOR"), false);
    assert.equal(roleAtLeast("EDITOR", "EDITOR"), true);
  });
});

describe("shareableRoles", () => {
  it("lists you create: editor or viewer", () => {
    assert.deepEqual(shareableRoles({ kind: "COLLECTION", slug: null }), ["EDITOR", "VIEWER"]);
    assert.deepEqual(shareableRoles({ kind: "COLLECTION", slug: "thrillers" }), ["EDITOR", "VIEWER"]);
  });

  it("Favoritas only to look at", () => {
    assert.deepEqual(shareableRoles({ kind: "COLLECTION", slug: "favoritas" }), ["VIEWER"]);
  });

  it("Quiero ver, Top del año, Por rewatch and the series lists are never shared", () => {
    assert.equal(isShareable({ kind: "WATCHLIST", slug: "watchlist" }), false);
    assert.equal(isShareable({ kind: "YEAR_TOP", slug: "top-2026" }), false);
    assert.equal(isShareable({ kind: "COLLECTION", slug: "por-rewatch" }), false);
    assert.equal(isShareable({ kind: "COLLECTION", slug: "series-en-progreso" }), false);
    assert.equal(isShareable({ kind: "COLLECTION", slug: "series-abandonadas" }), false);
  });
});
