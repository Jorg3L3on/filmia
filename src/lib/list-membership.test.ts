import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WATCHLIST_MEMBERSHIP_SLUG,
  membershipStatusCopy,
  titleListMembership,
  titleListMemberships,
} from "./list-membership";

const watchlist = { id: "w", name: "Quiero ver", slug: WATCHLIST_MEMBERSHIP_SLUG };
const favoritas = { id: "f", name: "Favoritas", slug: "favoritas" };
const rewatch = { id: "r", name: "Por rewatch", slug: "por-rewatch" };
const noir = { id: "n", name: "Noir de domingo", slug: null };
const animacion = { id: "a", name: "Animación", slug: null };

describe("titleListMemberships", () => {
  it("returns no lists for an unsaved title", () => {
    assert.deepEqual(titleListMemberships([]), { inWatchlist: false, lists: [] });
  });

  it("keeps Quiero ver out of the saved lists", () => {
    assert.deepEqual(titleListMemberships([watchlist]), { inWatchlist: true, lists: [] });
  });

  it("returns every list, ranked fixed-first then alphabetically", () => {
    const result = titleListMemberships([noir, watchlist, animacion, rewatch, favoritas]);
    assert.equal(result.inWatchlist, true);
    assert.deepEqual(
      result.lists.map((list) => list.id),
      ["f", "r", "a", "n"],
    );
  });

  it("drops duplicate rows for the same list", () => {
    const result = titleListMemberships([favoritas, favoritas, noir]);
    assert.deepEqual(
      result.lists.map((list) => list.id),
      ["f", "n"],
    );
  });

  it("keeps the secondary lists the single-list helper hides", () => {
    const lists = [favoritas, rewatch, noir];
    const single = titleListMembership(lists);
    assert.equal(single.state, "in-list");
    assert.equal(titleListMemberships(lists).lists.length, 3);
  });
});

describe("membershipStatusCopy", () => {
  it("is null with no saved lists", () => {
    assert.equal(membershipStatusCopy([]), null);
  });

  it("names a single list", () => {
    const copy = membershipStatusCopy([favoritas]);
    assert.equal(copy?.label, "Guardada en Favoritas");
    assert.equal(copy?.detail, null);
    assert.equal(copy?.count, 1);
  });

  it("names two lists inline", () => {
    const copy = membershipStatusCopy([favoritas, noir]);
    assert.equal(copy?.label, "Guardada en Favoritas y Noir de domingo");
    assert.equal(copy?.detail, null);
    assert.equal(copy?.count, 2);
  });

  it("collapses three or more to a count with every name in the detail", () => {
    const copy = membershipStatusCopy(titleListMemberships([noir, favoritas, rewatch]).lists);
    assert.equal(copy?.label, "En 3 listas");
    assert.equal(copy?.detail, "Favoritas · Por rewatch · Noir de domingo");
    assert.deepEqual(copy?.names, ["Favoritas", "Por rewatch", "Noir de domingo"]);
    assert.equal(copy?.count, 3);
  });

  it("reads as a status, never as the old button label", () => {
    for (const lists of [[favoritas], [favoritas, noir], [favoritas, noir, rewatch]]) {
      const label = membershipStatusCopy(lists)?.label ?? "";
      assert.notEqual(label, "En lista");
      assert.ok(!label.includes("Quiero ver"));
    }
  });
});
