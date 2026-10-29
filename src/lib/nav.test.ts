import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  desktopNavItems,
  isAuthChromePath,
  isDesktopNavCurrent,
  isImmersiveFichaPath,
  isCurrentPath,
  isListasHubPath,
  isMobileNavCurrent,
  mobileNavItems,
  mobileNavSearch,
  mobileNavSearchSlot,
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
  it("hides the chrome on auth screens, the Bienvenida and public shares", () => {
    assert.equal(isAuthChromePath("/login"), true);
    assert.equal(isAuthChromePath("/registro?callbackUrl=%2F"), true);
    assert.equal(isAuthChromePath("/bienvenida"), true);
    assert.equal(isAuthChromePath("/compartir/resena/abc.def"), true);
    assert.equal(isAuthChromePath("/oauth/consent?client_id=x"), true);
    assert.equal(isAuthChromePath("/"), false);
    assert.equal(isAuthChromePath("/perfil"), false);
  });
});

describe("mobile Listas tab", () => {
  it("is the second tab and lights on /listas/* and Quiero ver (FIL-34)", () => {
    assert.equal(isListasHubPath("/listas/abc"), true);
    assert.equal(isListasHubPath("/tags"), false);
    assert.equal(mobileNavItems[1]?.href, "/listas");
    assert.equal(mobileNavItems[1]?.icon, "lists");
    for (const path of ["/listas", "/listas/abc", "/watchlist", "/watchlist?orden=fecha"]) {
      assert.equal(isMobileNavCurrent("/listas", path), true, path);
      assert.equal(isMobileNavCurrent("/perfil", path), false, path);
    }
    assert.equal(isMobileNavCurrent("/listas", "/"), false);
    assert.equal(isMobileNavCurrent("/listas", "/perfil"), false);
    assert.equal(isMobileNavCurrent("/cine", "/listas"), false);
    assert.equal(isMobileNavCurrent("/buscar", "/listas"), false);
    assert.equal(mobileNavItems.some((item) => (item.href as string) === "/watchlist"), false);
  });
});

describe("mobile Cine tab", () => {
  it("sits after the Buscar disc and lights on /cine/*", () => {
    assert.deepEqual(
      mobileNavItems.map((item) => item.label),
      ["Hoy", "Listas", "Cine", "Perfil"],
    );
    assert.equal(mobileNavItems[mobileNavSearchSlot]?.href, "/cine");
    assert.equal(isMobileNavCurrent("/cine", "/cine"), true);
    assert.equal(isMobileNavCurrent("/cine", "/cine/cartelera"), true);
    assert.equal(isMobileNavCurrent("/cine", "/cinema"), false);
    assert.equal(isMobileNavCurrent("/perfil", "/cine/proximamente"), false);
  });
});

describe("desktop header nav", () => {
  it("ends with a Perfil tab", () => {
    assert.deepEqual(
      desktopNavItems.map((item) => item.label),
      ["Hoy", "Listas", "Buscar", "Cine", "Perfil"],
    );
  });

  it("lights Perfil on /perfil and on Tu diario", () => {
    assert.equal(isDesktopNavCurrent("/perfil", "/perfil"), true);
    assert.equal(isDesktopNavCurrent("/perfil", "/diario"), true);
    assert.equal(isDesktopNavCurrent("/perfil", "/diario?view=grid"), true);
    assert.equal(isDesktopNavCurrent("/perfil", "/"), false);
    assert.equal(isDesktopNavCurrent("/", "/diario"), false);
    assert.equal(isDesktopNavCurrent("/perfil", "/listas/abc"), false);
    assert.equal(isDesktopNavCurrent("/listas", "/listas/abc"), true);
    assert.equal(isDesktopNavCurrent("/listas", "/watchlist"), true);
    assert.equal(isDesktopNavCurrent("/cine", "/cine/proximamente"), true);
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

describe("isImmersiveFichaPath", () => {
  it("only the ficha itself drops the mobile header", () => {
    assert.equal(isImmersiveFichaPath("/titulos/abc"), true);
    assert.equal(isImmersiveFichaPath("/titulos/abc?x=1"), true);
    assert.equal(isImmersiveFichaPath("/titulos/abc/editar"), false);
    assert.equal(isImmersiveFichaPath("/titulos/tmdb/pelicula/340666"), true);
    assert.equal(isImmersiveFichaPath("/titulos/tmdb/serie/1399?fecha=2026-10-12"), true);
    assert.equal(isImmersiveFichaPath("/titulos/tmdb/otro/1"), false);
    assert.equal(isImmersiveFichaPath("/titulos"), false);
    assert.equal(isImmersiveFichaPath("/watchlist"), false);
  });
});
