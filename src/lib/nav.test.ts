import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  desktopNavItems,
  isAuthChromePath,
  isCurrentPath,
  isListasHubPath,
  isMobileNavCurrent,
  mobileCreateActions,
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
    const hrefs: string[] = [...desktopNavItems, ...mobileCreateActions].map((item) => item.href);
    const labels: string[] = [...desktopNavItems, ...mobileCreateActions].map((item) => item.label);
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
