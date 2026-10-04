import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  desktopNavItems,
  isCurrentPath,
  isListasHubPath,
  isMobileNavCurrent,
  isTagsPath,
} from "./nav";

describe("isCurrentPath nested routes", () => {
  it("keeps Diario active on /titulos/*", () => {
    assert.equal(isCurrentPath("/", "/titulos/abc"), true);
    assert.equal(isCurrentPath("/", "/"), true);
    assert.equal(isCurrentPath("/", "/watchlist"), false);
  });

  it("keeps Listas active on /listas/* and /tags/* (segment hub)", () => {
    assert.equal(isCurrentPath("/listas", "/listas"), true);
    assert.equal(isCurrentPath("/listas", "/listas/xyz"), true);
    assert.equal(isCurrentPath("/listas", "/tags"), true);
    assert.equal(isCurrentPath("/listas", "/tags/sci-fi"), true);
  });

  it("desktop nav has no separate Etiquetas item", () => {
    const hrefs: string[] = desktopNavItems.map((item) => item.href);
    const labels: string[] = desktopNavItems.map((item) => item.label);
    assert.equal(hrefs.includes("/tags"), false);
    assert.equal(labels.includes("Etiquetas"), false);
  });
});

describe("mobile Listas hub", () => {
  it("treats tags under Listas for bottom nav", () => {
    assert.equal(isTagsPath("/tags/foo"), true);
    assert.equal(isListasHubPath("/tags"), true);
    assert.equal(isListasHubPath("/listas/abc"), true);
    assert.equal(isMobileNavCurrent("/listas", "/tags"), true);
    assert.equal(isMobileNavCurrent("/listas", "/tags/foo"), true);
    assert.equal(isMobileNavCurrent("/buscar", "/tags"), false);
  });
});
