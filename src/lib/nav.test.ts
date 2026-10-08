import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  desktopNavItems,
  isAuthChromePath,
  isDesktopNavCurrent,
  isCurrentPath,
  isListasHubPath,
  isMobileNavCurrent,
  mobileNavItems,
  mobileNavSearch,
} from "./nav";

describe("isCurrentPath nested routes", () => {
  it("keeps Diario active on /titulos/*", () => {
    assert.equal(isCurrentPath("/", "/titulos/abc"), true);
    assert.equal(isCurrentPath("/", "/"), true);
    assert.equal(isCurrentPath("/", "/watchlist"), false);
  });

  it("keeps Listas active on /listas/*", () => {
    assert.equal(isCurrentPath("/listas", "/listas"), true);
    assert.equal(isCurrentPath("/listas", "/listas/xyz"), true);
    assert.equal(isCurrentPath("/listas", "/watchlist"), false);
  });

  it("has no Etiquetas entry anywhere in the nav", () => {
    const hrefs: string[] = [...desktopNavItems, ...mobileNavItems, mobileNavSearch].map((item) => item.href);
    const labels: string[] = [...desktopNavItems, ...mobileNavItems, mobileNavSearch].map((item) => item.label);
    assert.equal(hrefs.includes("/tags"), false);
    assert.equal(labels.includes("Etiquetas"), false);
  });
});

describe("isAuthChromePath", () => {
  it("hides the chrome on auth screens and the Bienvenida", () => {
    assert.equal(isAuthChromePath("/login"), true);
    assert.equal(isAuthChromePath("/registro?callbackUrl=%2F"), true);
    assert.equal(isAuthChromePath("/bienvenida"), true);
    assert.equal(isAuthChromePath("/"), false);
    assert.equal(isAuthChromePath("/perfil"), false);
  });
});

describe("mobile Listas hub", () => {
  it("lights Listas on /listas/* only", () => {
    assert.equal(isListasHubPath("/listas/abc"), true);
    assert.equal(isListasHubPath("/tags"), false);
    assert.equal(isMobileNavCurrent("/listas", "/listas/abc"), true);
    assert.equal(isMobileNavCurrent("/buscar", "/listas"), false);
  });
});

describe("desktop header nav", () => {
  it("ends with a Perfil tab", () => {
    assert.deepEqual(
      desktopNavItems.map((item) => item.label),
      ["Hoy", "Quiero ver", "Listas", "Buscar", "Perfil"],
    );
  });

  it("lights Perfil on /perfil and on Tu diario", () => {
    assert.equal(isDesktopNavCurrent("/perfil", "/perfil"), true);
    assert.equal(isDesktopNavCurrent("/perfil", "/diario"), true);
    assert.equal(isDesktopNavCurrent("/perfil", "/diario?view=grid"), true);
    assert.equal(isDesktopNavCurrent("/perfil", "/"), false);
    assert.equal(isDesktopNavCurrent("/", "/diario"), false);
    assert.equal(isDesktopNavCurrent("/listas", "/listas/abc"), true);
  });
});

describe("mobile Buscar disc", () => {
  it("lights only on /buscar, where no tab is current", () => {
    assert.equal(mobileNavSearch.href, "/buscar");
    assert.equal(isMobileNavCurrent(mobileNavSearch.href, "/buscar"), true);
    assert.equal(isMobileNavCurrent(mobileNavSearch.href, "/buscar?q=dune"), true);
    assert.equal(isMobileNavCurrent(mobileNavSearch.href, "/"), false);
    assert.equal(
      mobileNavItems.some((item) => isMobileNavCurrent(item.href, "/buscar")),
      false,
    );
  });
});
