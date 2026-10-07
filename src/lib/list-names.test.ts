import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasDuplicateListName,
  LIST_NAME_TAKEN_MESSAGE,
  listNameKey,
} from "@/lib/list-names";

const userLists = [
  { id: "watchlist", name: "Quiero ver" },
  { id: "favoritas", name: "Favoritas" },
  { id: "rewatch", name: "Por rewatch" },
  { id: "terror", name: "Terror de los 80" },
  { id: "noches", name: "Noches de película" },
];

describe("listNameKey", () => {
  it("ignores case, accents and surrounding or repeated spaces", () => {
    assert.equal(listNameKey("  Noches   de PELÍCULA "), "noches-de-pelicula");
    assert.equal(listNameKey("Noches de película"), listNameKey("noches-de-pelicula"));
  });

  it("falls back to the lowercased text when nothing alphanumeric remains", () => {
    assert.equal(listNameKey(" 🎃  🍿 "), "🎃 🍿");
    assert.notEqual(listNameKey("🎃"), listNameKey("🍿"));
  });
});

describe("hasDuplicateListName", () => {
  it("detects a custom list with the same normalized name", () => {
    assert.equal(hasDuplicateListName("terror de los 80", userLists), true);
    assert.equal(hasDuplicateListName("Noches de pelicula", userLists), true);
    assert.equal(hasDuplicateListName("Terror de los 90", userLists), false);
  });

  it("includes the daily lists", () => {
    assert.equal(hasDuplicateListName("favoritas", userLists), true);
    assert.equal(hasDuplicateListName("QUIERO VER", userLists), true);
    assert.equal(hasDuplicateListName("Por re-watch", userLists), false);
    assert.equal(hasDuplicateListName("Por  Rewatch", userLists), true);
  });

  it("ignores the list being renamed", () => {
    assert.equal(hasDuplicateListName("Terror de los 80", userLists, "terror"), false);
    assert.equal(hasDuplicateListName("Terror de los 80", userLists, "noches"), true);
  });

  it("treats symbol-only names as duplicates only when they match", () => {
    const withEmoji = [...userLists, { id: "halloween", name: "🎃" }];
    assert.equal(hasDuplicateListName(" 🎃 ", withEmoji), true);
    assert.equal(hasDuplicateListName("🍿", withEmoji), false);
  });

  it("uses the exact copy for the error", () => {
    assert.equal(LIST_NAME_TAKEN_MESSAGE, "Ya tienes una lista con ese nombre.");
  });
});
