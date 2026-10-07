import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diffListSelection,
  initialListSelection,
  listSelectionConfirmLabel,
  listSelectionToast,
  splitStatusListSelection,
  toggleListSelection,
} from "./list-selection";

const lists = [
  { id: "w", name: "Quiero ver", slug: "watchlist" },
  { id: "f", name: "Favoritas", slug: "favoritas" },
  { id: "n", name: "Noir de domingo", slug: null },
];

describe("diffListSelection", () => {
  it("reports adds and removes regardless of order", () => {
    assert.deepEqual(diffListSelection(["f", "n"], ["n", "w"]), {
      add: ["w"],
      remove: ["f"],
      changed: true,
    });
  });

  it("is unchanged when the same lists are picked", () => {
    assert.equal(diffListSelection(["f", "n"], ["n", "f"]).changed, false);
  });

  it("collapses duplicate ids", () => {
    assert.deepEqual(diffListSelection([], ["f", "f"]).add, ["f"]);
  });
});

describe("toggleListSelection", () => {
  it("adds and removes one id", () => {
    assert.deepEqual(toggleListSelection(["f"], "n"), ["f", "n"]);
    assert.deepEqual(toggleListSelection(["f", "n"], "f"), ["n"]);
  });
});

describe("initialListSelection", () => {
  it("takes Quiero ver from the catalog flag, not the stored memberships", () => {
    assert.deepEqual(
      initialListSelection({ lists, memberListIds: ["w", "n"], inWatchlist: false }),
      ["n"],
    );
    assert.deepEqual(
      initialListSelection({ lists, memberListIds: ["n"], inWatchlist: true }),
      ["w", "n"],
    );
  });

  it("drops ids of lists the user no longer has", () => {
    assert.deepEqual(
      initialListSelection({ lists, memberListIds: ["gone", "f"], inWatchlist: false }),
      ["f"],
    );
  });
});

describe("list selection copy", () => {
  it("labels the confirm button", () => {
    assert.equal(listSelectionConfirmLabel(diffListSelection([], []), 0), "Sin cambios");
    assert.equal(listSelectionConfirmLabel(diffListSelection([], ["f"]), 1), "Guardar en 1 lista");
    assert.equal(
      listSelectionConfirmLabel(diffListSelection(["f"], ["f", "n"]), 2),
      "Guardar en 2 listas",
    );
    assert.equal(listSelectionConfirmLabel(diffListSelection(["f"], []), 0), "Quitar de las listas");
  });

  it("names the list in the toast when only one was added or removed", () => {
    assert.deepEqual(listSelectionToast(lists, diffListSelection([], ["n"]), "Dune"), {
      title: "En Noir de domingo",
      description: "Dune",
    });
    assert.equal(listSelectionToast(lists, diffListSelection([], ["n", "f"]), "Dune").title, "En 2 listas");
    assert.equal(listSelectionToast(lists, diffListSelection(["f"], []), "Dune").title, "Fuera de Favoritas");
    assert.equal(
      listSelectionToast(lists, diffListSelection(["f"], ["n"]), "Dune").title,
      "Listas actualizadas",
    );
  });
});

describe("splitStatusListSelection", () => {
  const withStatus = [
    ...lists,
    { id: "p", name: "Series en progreso", slug: "series-en-progreso" },
    { id: "a", name: "Series abandonadas", slug: "series-abandonadas" },
  ];

  it("pulls status lists out of the editable selection", () => {
    const { statusLists, editableIds } = splitStatusListSelection(withStatus, ["f", "p", "n"]);
    assert.deepEqual(
      statusLists.map((list) => list.id),
      ["p"],
    );
    assert.deepEqual(editableIds, ["f", "n"]);
  });

  it("ignores status lists the title is not in", () => {
    const { statusLists, editableIds } = splitStatusListSelection(withStatus, ["w"]);
    assert.deepEqual(statusLists, []);
    assert.deepEqual(editableIds, ["w"]);
  });

  it("keeps a status membership out of the picker diff", () => {
    const initial = ["p", "n"];
    const selected = toggleListSelection(initial, "f");
    assert.deepEqual(diffListSelection(initial, selected), {
      add: ["f"],
      remove: [],
      changed: true,
    });
  });
});
