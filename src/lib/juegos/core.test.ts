import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JUEGOS,
  juegosNovedad,
  latestLaunchOn,
  mxDayStart,
  parseJuegosEntry,
  portadaOf,
  weekKeyOf,
  type Juego,
} from "@/lib/juegos/core";
import { isJuegoPlayPath, isJuegosPath, isMobileNavCurrent, mobileNavItems, desktopNavItems } from "@/lib/nav";

const juego = (overrides: Partial<Juego>): Juego => ({
  id: "x",
  name: "X",
  line: "",
  status: "available",
  href: "/extras/x",
  launchedOn: "2026-11-12",
  season: null,
  ...overrides,
});

describe("Juegos cartel (FIL-I50-2)", () => {
  it("launches with La tanda playable and the rest in «Próximamente»", () => {
    const portada = portadaOf(JUEGOS, "2026-11-20");
    assert.equal(portada.seasonal, null);
    assert.deepEqual(
      portada.playable.map((item) => item.id),
      ["tanda"],
    );
    assert.deepEqual(
      portada.soon.map((item) => item.id),
      ["quiniela", "muro", "duelos", "linea", "mayor"],
    );
  });

  it("puts a seasonal game on top only inside its window", () => {
    const oscar = juego({ id: "oscar", status: "seasonal", season: { from: "2027-01-22", to: "2027-03-14" }, launchedOn: "2027-01-22" });
    assert.equal(portadaOf([oscar], "2027-02-01").seasonal?.id, "oscar");
    assert.equal(portadaOf([oscar], "2027-04-01").seasonal, null);
    assert.deepEqual(
      portadaOf([oscar], "2027-04-01").soon.map((item) => item.id),
      ["oscar"],
    );
  });

  it("a game launching later is «Próximamente» until its day", () => {
    const later = juego({ id: "muro", launchedOn: "2026-12-07" });
    assert.deepEqual(portadaOf([later], "2026-12-06").playable, []);
    assert.equal(portadaOf([later], "2026-12-07").playable[0]?.id, "muro");
    assert.equal(latestLaunchOn([later], "2026-12-06"), null);
  });
});

describe("Juegos' «nuevo» dot (FIL-I50-2)", () => {
  const tanda = juego({ id: "tanda", launchedOn: "2026-11-12" });
  // Thursday 2026-11-19, 14:00 in Mexico City.
  const now = new Date("2026-11-19T20:00:00Z");

  it("is on until the portada is opened, then off", () => {
    assert.equal(juegosNovedad({ lastOpenedAt: null, now, juegos: [tanda] }), true);
    assert.equal(juegosNovedad({ lastOpenedAt: new Date("2026-11-18T15:00:00Z"), now, juegos: [tanda] }), false);
  });

  it("comes back with Monday's new tanda", () => {
    // Opened on Saturday the 14th: before this week's Monday (the 16th).
    assert.equal(juegosNovedad({ lastOpenedAt: new Date("2026-11-14T18:00:00Z"), now, juegos: [tanda] }), true);
  });

  it("comes back with a new launch", () => {
    const muro = juego({ id: "muro", launchedOn: "2026-11-19" });
    const openedTuesday = new Date("2026-11-17T18:00:00Z");
    assert.equal(juegosNovedad({ lastOpenedAt: openedTuesday, now, juegos: [tanda] }), false);
    assert.equal(juegosNovedad({ lastOpenedAt: openedTuesday, now, juegos: [tanda, muro] }), true);
  });

  it("is off before anything has launched", () => {
    assert.equal(juegosNovedad({ lastOpenedAt: null, now, juegos: [juego({ launchedOn: "2027-01-01" })] }), false);
  });
});

describe("La tanda's week", () => {
  it("turns on Monday in Mexico City", () => {
    assert.equal(weekKeyOf(new Date("2026-11-16T05:59:00Z")), "2026-11-09"); // Sunday 23:59 CDMX
    assert.equal(weekKeyOf(new Date("2026-11-16T06:00:00Z")), "2026-11-16"); // Monday 00:00 CDMX
    assert.equal(weekKeyOf(new Date("2026-11-22T20:00:00Z")), "2026-11-16"); // Sunday afternoon
    assert.equal(mxDayStart("2026-11-16").toISOString(), "2026-11-16T06:00:00.000Z");
  });

  it("knows the two doors and nothing else", () => {
    assert.equal(parseJuegosEntry("boton"), "boton");
    assert.equal(parseJuegosEntry("bloque"), "bloque");
    assert.equal(parseJuegosEntry("dock"), null);
  });
});

describe("Juegos in the navigation", () => {
  it("lights Hoy, hides the dock only while playing", () => {
    assert.equal(isJuegosPath("/extras"), true);
    assert.equal(isJuegosPath("/extras/tanda"), true);
    assert.equal(isJuegosPath("/extrasx"), false);
    assert.equal(isJuegoPlayPath("/extras"), false);
    assert.equal(isJuegoPlayPath("/extras/tanda"), true);
    assert.equal(isMobileNavCurrent("/", "/extras"), true);
    assert.equal(isMobileNavCurrent("/", "/extras/tanda?x=1"), true);
    assert.equal(isMobileNavCurrent("/perfil", "/extras"), false);
  });

  it("has no Juegos entry in the dock or the desktop header", () => {
    assert.ok(!mobileNavItems.some((item) => item.href.startsWith("/extras")));
    assert.ok(!desktopNavItems.some((item) => item.href.startsWith("/extras")));
  });
});
