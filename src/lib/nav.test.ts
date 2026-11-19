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
  isParaTiPath,
  mobileNavItems,
  mobileNavSearch,
  mobileNavSearchSlot,
  navTabMatcher,
  showsFloatingAvatar,
} from "./nav";

describe("isCurrentPath nested routes", () => {
  it("Hoy is only Hoy: a ficha is no tab of its own (FIL-I44-8)", () => {
    assert.equal(isCurrentPath("/", "/titulos/abc"), false);
    assert.equal(isCurrentPath("/", "/"), true);
    assert.equal(isCurrentPath("/", "/watchlist"), false);
  });

  it("a ficha lights the tab it came from, Hoy without one (FIL-I44-8)", () => {
    assert.equal(navTabMatcher("/listas")("/listas", "/titulos/abc"), true);
    assert.equal(navTabMatcher("/listas")("/", "/titulos/abc"), false);
    assert.equal(navTabMatcher(null)("/", "/titulos/tmdb/pelicula/1"), true);
    assert.equal(navTabMatcher("/cine")("/cine", "/cine/cartelera"), true);
    assert.equal(navTabMatcher("/cine")("/cine", "/listas"), false);
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

describe("dock order (FIL-I60-1)", () => {
  it("is Hoy · Para ti · [Buscar] · Listas · Cine on the phone; Perfil is no tab", () => {
    assert.deepEqual(
      mobileNavItems.map((item) => item.label),
      ["Hoy", "Para ti", "Listas", "Cine"],
    );
    assert.equal(mobileNavSearchSlot, 2);
    assert.equal(mobileNavItems.some((item) => (item.href as string) === "/perfil"), false);
  });

  it("is Hoy · Para ti · Buscar · Listas · Cine on desktop; Perfil is no tab", () => {
    assert.deepEqual(
      desktopNavItems.map((item) => item.label),
      ["Hoy", "Para ti", "Buscar", "Listas", "Cine"],
    );
    assert.equal(desktopNavItems.some((item) => (item.href as string) === "/perfil"), false);
  });

  it("lights Para ti on /para-ti and a ficha opened from it", () => {
    assert.equal(isParaTiPath("/para-ti"), true);
    assert.equal(isParaTiPath("/para-ti?antojo=miedo"), true);
    assert.equal(isParaTiPath("/para-tiempo"), false);
    assert.equal(isMobileNavCurrent("/para-ti", "/para-ti?antojo=reir"), true);
    assert.equal(isMobileNavCurrent("/para-ti", "/"), false);
    assert.equal(isMobileNavCurrent("/", "/para-ti"), false);
    assert.equal(navTabMatcher("/para-ti")("/para-ti", "/titulos/tmdb/pelicula/1"), true);
    assert.equal(navTabMatcher("/para-ti")("/", "/titulos/tmdb/pelicula/1"), false);
  });

  it("a ficha opened from Perfil lights no tab, only the avatar", () => {
    const match = navTabMatcher("/perfil");
    for (const item of mobileNavItems) {
      assert.equal(match(item.href, "/titulos/abc"), false, item.href);
    }
    assert.equal(match("/perfil", "/titulos/abc"), true);
  });

  it("the avatar lights on Perfil and Tu diario, where no tab is lit", () => {
    for (const path of ["/perfil", "/perfil/conexiones", "/diario", "/diario?view=grid"]) {
      assert.equal(isMobileNavCurrent("/perfil", path), true, path);
      assert.equal(mobileNavItems.some((item) => isMobileNavCurrent(item.href, path)), false, path);
    }
  });

  it("floats the avatar on the top pages only", () => {
    for (const path of ["/", "/para-ti", "/para-ti?antojo=miedo", "/listas", "/watchlist", "/cine", "/perfil", "/diario"]) {
      assert.equal(showsFloatingAvatar(path), true, path);
    }
    for (const path of [
      "/titulos/abc",
      "/titulos/tmdb/serie/1",
      "/listas/abc",
      "/cine/cartelera",
      "/extras/tanda",
      "/reto/x",
      "/login",
      "/registro",
      "/bienvenida",
      "/buscar",
      "/perfil/conexiones",
    ]) {
      assert.equal(showsFloatingAvatar(path), false, path);
    }
  });
});

describe("mobile Listas tab", () => {
  it("is the third tab and lights on /listas/* and Quiero ver (FIL-34)", () => {
    assert.equal(isListasHubPath("/listas/abc"), true);
    assert.equal(isListasHubPath("/tags"), false);
    assert.equal(mobileNavItems[2]?.href, "/listas");
    assert.equal(mobileNavItems[2]?.icon, "lists");
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
  it("is the last tab and lights on /cine/*", () => {
    assert.equal(mobileNavItems[mobileNavItems.length - 1]?.href, "/cine");
    assert.equal(isMobileNavCurrent("/cine", "/cine"), true);
    assert.equal(isMobileNavCurrent("/cine", "/cine/cartelera"), true);
    assert.equal(isMobileNavCurrent("/cine", "/cinema"), false);
    assert.equal(isMobileNavCurrent("/perfil", "/cine/proximamente"), false);
  });
});

describe("desktop header nav", () => {
  it("lights the avatar's /perfil on /perfil and on Tu diario", () => {
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
