import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FICHA_CACHE_LIMIT,
  fichaHref,
  readRecentFichaHrefs,
  rememberOpenedFicha,
} from "./ficha-session";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const store = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
};

describe("ficha session cache", () => {
  it("builds a ficha href", () => {
    assert.equal(fichaHref("abc"), "/titulos/abc");
  });

  it("remembers recent fichas newest first and caps the list", () => {
    const storage = memoryStorage();
    rememberOpenedFicha("one", storage);
    rememberOpenedFicha("two", storage);
    rememberOpenedFicha("one", storage);

    assert.deepEqual(readRecentFichaHrefs(storage), ["/titulos/one", "/titulos/two"]);

    for (let index = 0; index < FICHA_CACHE_LIMIT + 3; index += 1) {
      rememberOpenedFicha(`t${index}`, storage);
    }

    const hrefs = readRecentFichaHrefs(storage);
    assert.equal(hrefs.length, FICHA_CACHE_LIMIT);
    assert.equal(hrefs[0], `/titulos/t${FICHA_CACHE_LIMIT + 2}`);
  });

  it("ignores blank ids and missing storage", () => {
    assert.deepEqual(rememberOpenedFicha("   "), []);
    assert.deepEqual(readRecentFichaHrefs(), []);
  });
});
