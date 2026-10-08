import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NAV_STACK_KEY,
  NAV_STACK_LIMIT,
  backAction,
  backLabel,
  deckCardFrom,
  deckIndexOf,
  defaultNavLabel,
  labelCurrent,
  navOrigin,
  parseDeckCard,
  readNavStack,
  recordVisit,
  saveCurrentScroll,
  truncateNavLabel,
  withDeckCard,
  writeNavStack,
  type NavEntry,
} from "./nav-origin";

const visitAll = (hrefs: string[], start: NavEntry[] = []) =>
  hrefs.reduce((stack, href) => recordVisit(stack, href).stack, start);

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
};

describe("nav-origin/recordVisit", () => {
  it("pushes new pages and labels them by default", () => {
    const stack = visitAll(["/watchlist", "/titulos/abc"]);
    assert.deepEqual(stack, [
      { href: "/watchlist", label: "Quiero ver" },
      { href: "/titulos/abc", label: "Ficha" },
    ]);
    assert.equal(navOrigin(stack)?.href, "/watchlist");
  });

  it("same page with a new query replaces the top (Hoy's lens and card)", () => {
    const stack = visitAll(["/", "/?lente=terror&carta=t1", "/?lente=terror&carta=t7"]);
    assert.deepEqual(stack, [{ href: "/?lente=terror&carta=t7", label: "Hoy" }]);
  });

  it("returning to the page below pops and hands back its entry (scroll)", () => {
    let stack = visitAll(["/watchlist"]);
    stack = saveCurrentScroll(stack, "/watchlist", 1840.4);
    stack = recordVisit(stack, "/titulos/abc").stack;
    const back = recordVisit(stack, "/watchlist");
    assert.deepEqual(back.stack, [{ href: "/watchlist", label: "Quiero ver", scrollY: 1840 }]);
    assert.equal(back.restored?.scrollY, 1840);
    assert.equal(back.kind, "pop");
  });

  it("saving the scroll also takes the live query (replaceState Next did not report)", () => {
    const stack = visitAll(["/buscar?q=noche"]);
    const saved = saveCurrentScroll(stack, "/buscar?q=noche&tipo=pelicula", 229);
    assert.deepEqual(saved, [{ href: "/buscar?q=noche&tipo=pelicula", label: "Buscar", scrollY: 229 }]);
    assert.deepEqual(saveCurrentScroll(stack, "/titulos/a", 10), stack, "another page never overwrites the top");
  });

  it("reports the kind of visit (push starts a page at the top)", () => {
    const stack = visitAll(["/watchlist"]);
    assert.equal(recordVisit(stack, "/titulos/a").kind, "push");
    assert.equal(recordVisit(stack, "/watchlist?sort=year").kind, "replace");
    assert.equal(recordVisit(stack, "/watchlist").kind, "none");
    assert.equal(recordVisit([], "/watchlist").kind, "none", "first page of the tab keeps the browser's scroll");
  });

  it("ficha → relacionada → atrás vuelve a la primera ficha, luego al origen", () => {
    let stack = visitAll(["/?lente=terror&carta=t7", "/titulos/a"]);
    stack = labelCurrent(stack, "/titulos/a", "Obsesión");
    stack = recordVisit(stack, "/titulos/b").stack;
    assert.equal(backLabel(stack), "Obsesión");
    stack = recordVisit(stack, "/titulos/a").stack;
    assert.equal(navOrigin(stack)?.href, "/?lente=terror&carta=t7");
    stack = recordVisit(stack, "/?lente=terror&carta=t7").stack;
    assert.equal(stack.length, 1);
  });

  it("ficha → persona → otra ficha → atrás → atrás deshace el camino en orden", () => {
    let stack = visitAll(["/titulos/a", "/buscar?persona=1&rol=reparto", "/titulos/b"]);
    stack = recordVisit(stack, "/buscar?persona=1&rol=reparto").stack;
    assert.equal(navOrigin(stack)?.href, "/titulos/a");
    stack = recordVisit(stack, "/titulos/a").stack;
    assert.equal(navOrigin(stack), null);
  });

  it("revisiting the current href or untracked pages changes nothing", () => {
    const stack = visitAll(["/watchlist"]);
    assert.deepEqual(recordVisit(stack, "/watchlist").stack, stack);
    assert.deepEqual(recordVisit(stack, "/login?next=/").stack, stack);
    assert.deepEqual(recordVisit(stack, "/bienvenida").stack, stack);
  });

  it("keeps a bounded stack", () => {
    const stack = visitAll(Array.from({ length: 30 }, (_, index) => `/titulos/${index}`));
    assert.equal(stack.length, NAV_STACK_LIMIT);
    assert.equal(stack.at(-1)?.href, "/titulos/29");
  });
});

describe("nav-origin/labels", () => {
  it("default labels per page", () => {
    assert.equal(defaultNavLabel("/?lente=terror"), "Hoy");
    assert.equal(defaultNavLabel("/watchlist"), "Quiero ver");
    assert.equal(defaultNavLabel("/listas/xyz?carta=1"), "Listas");
    assert.equal(defaultNavLabel("/buscar?q=fincher"), "Buscar");
    assert.equal(defaultNavLabel("/perfil"), "Perfil");
    assert.equal(defaultNavLabel("/diario?view=calendar"), "Diario");
  });

  it("a page names itself only while it is the top entry", () => {
    const stack = visitAll(["/?lente=terror"]);
    assert.equal(labelCurrent(stack, "/?lente=terror&carta=x", "Hoy · Terror")[0].label, "Hoy · Terror");
    assert.deepEqual(labelCurrent(stack, "/titulos/a", "Obsesión"), stack);
    assert.deepEqual(labelCurrent(stack, "/", "  "), stack);
  });

  it("truncates long labels", () => {
    assert.equal(truncateNavLabel("Nosferatu: el vampiro de la noche eterna", 20), "Nosferatu: el vampi…");
    assert.equal(truncateNavLabel("  Hoy   ·  Terror "), "Hoy · Terror");
  });
});

describe("nav-origin/backAction", () => {
  it("router.back when the origin is the previous in-app entry", () => {
    const stack = visitAll(["/watchlist", "/titulos/a"]);
    assert.deepEqual(backAction(stack, 4), { kind: "back" });
    assert.equal(backLabel(stack), "Quiero ver");
  });

  it("enlace directo o recarga en una pestaña nueva: push a Hoy, sin salir del app", () => {
    const stack = visitAll(["/titulos/a"]);
    assert.deepEqual(backAction(stack, 1), { kind: "push", href: "/" });
    assert.deepEqual(backAction(stack, 5), { kind: "push", href: "/" });
    assert.equal(backLabel(stack), "Hoy");
  });

  it("origin known but no browser history (copied tab): push the origin", () => {
    const stack = visitAll(["/?lente=terror&carta=t7", "/titulos/a"]);
    assert.deepEqual(backAction(stack, 1), { kind: "push", href: "/?lente=terror&carta=t7" });
  });
});

describe("nav-origin/storage", () => {
  it("round-trips and drops junk", () => {
    const storage = memoryStorage();
    writeNavStack([{ href: "/watchlist", label: "Quiero ver", scrollY: 10 }], storage);
    assert.deepEqual(readNavStack(storage), [{ href: "/watchlist", label: "Quiero ver", scrollY: 10 }]);
    storage.setItem(NAV_STACK_KEY, JSON.stringify([{ href: "https://evil", label: "x" }, { href: "/ok", label: "Ok" }, 3]));
    assert.deepEqual(readNavStack(storage), [{ href: "/ok", label: "Ok" }]);
    storage.setItem(NAV_STACK_KEY, "{not json");
    assert.deepEqual(readNavStack(storage), []);
    assert.deepEqual(readNavStack(null), []);
  });
});

describe("nav-origin/deck card", () => {
  const deck = [{ id: "t1" }, { id: "t2" }, { id: "t7" }];

  it("reads and writes ?carta= keeping the other params", () => {
    assert.equal(deckCardFrom("?lente=terror&carta=t7"), "t7");
    assert.equal(deckCardFrom("?lente=terror"), null);
    assert.equal(withDeckCard("/listas/x?sort=year&carta=t1", "t7"), "/listas/x?sort=year&carta=t7");
    assert.equal(withDeckCard("/listas/x", "t2"), "/listas/x?carta=t2");
    assert.equal(parseDeckCard([" t7 ", "t1"]), "t7");
    assert.equal(parseDeckCard(""), null);
  });

  it("restores by id, not index; a card that left the deck falls back", () => {
    assert.equal(deckIndexOf(deck, "t7"), 2);
    assert.equal(deckIndexOf(deck, "gone"), null);
    assert.equal(deckIndexOf(deck, null), null);
  });
});
